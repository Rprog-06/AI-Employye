import json
import os
import sys
from collections import Counter
import csv
from datetime import UTC, datetime

import joblib
import numpy as np
from pymongo import MongoClient
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACT_DIR = os.path.join(CURRENT_DIR, "ml_artifacts")
MODEL_PATH = os.path.join(ARTIFACT_DIR, "recommendation_model.joblib")
METADATA_PATH = os.path.join(ARTIFACT_DIR, "recommendation_model_metadata.json")
DATASET_PATH = os.path.join(ARTIFACT_DIR, "employee_recommendation_training.csv")

if CURRENT_DIR not in sys.path:
    sys.path.append(CURRENT_DIR)

from config import DATABASE_NAME, MONGO_URI  # noqa: E402

FEATURE_NAMES = [
    "taskEfficiency",
    "codeScore",
    "feedbackScore",
    "attendanceScore",
    "trendDelta",
    "totalTasks",
    "overdueCount",
    "feedbackCount",
    "attendanceDays",
]

STATUS_WEIGHTS = {
    "done": 1,
    "completed": 1,
    "assigned": 0.55,
    "in progress": 0.75,
    "pending": 0.4,
}


def get_local_month_key():
    now = datetime.now()
    return f"{now.year:04d}-{now.month:02d}"


def count_working_days_for_month(month_key):
    try:
        year_str, month_str = str(month_key).split("-")
        year = int(year_str)
        month = int(month_str)
    except Exception:
        return 0

    now = datetime.now()
    is_current_month = now.year == year and now.month == month
    if month == 12:
        days_in_month = 31
    else:
        next_month = datetime(year + (1 if month == 12 else 0), 1 if month == 12 else month + 1, 1)
        current_month = datetime(year, month, 1)
        days_in_month = (next_month - current_month).days

    end_day = min(now.day, days_in_month) if is_current_month else days_in_month
    working_days = 0
    for day in range(1, end_day + 1):
        if datetime(year, month, day).weekday() < 5:
            working_days += 1
    return working_days


def parse_datetime(value):
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except Exception:
        return None


def calculate_trend_delta(monthly_rows):
    if not monthly_rows or len(monthly_rows) < 2:
        return 0.0

    recent = monthly_rows[-2:]
    previous = monthly_rows[-4:-2]
    if not previous:
        return float((recent[-1].get("performance_score") or 0) - (recent[0].get("performance_score") or 0))

    recent_avg = sum(float(row.get("performance_score") or 0) for row in recent) / len(recent)
    previous_avg = sum(float(row.get("performance_score") or 0) for row in previous) / len(previous)
    return round(recent_avg - previous_avg, 2)


def build_employee_matcher(employee):
    values = []
    for key in ("name", "jiraDisplayName"):
        value = (employee.get(key) or "").strip()
        if value:
            values.append(value)
    return values


def derive_label(row):
    if row["trendDelta"] <= -10:
        return "Create recovery plan"
    if row["overdueCount"] >= 2 or row["taskEfficiency"] < 55 or row["totalTasks"] >= 8:
        return "Rebalance workload"
    if row["codeScore"] < 60:
        return "Assign mentorship"
    if row["feedbackScore"] < 65:
        return "Plan targeted training"
    if row["attendanceScore"] < 75:
        return "Schedule attendance follow-up"
    if row["trendDelta"] >= 8:
        return "Prepare stretch assignment"
    return "Maintain current plan"


def build_current_feature_rows():
    client = MongoClient(MONGO_URI)
    db = client[DATABASE_NAME]
    month = get_local_month_key()
    working_days = count_working_days_for_month(month)

    employees = list(
        db["employees"].find({"role": "employee"}, {"name": 1, "jiraDisplayName": 1, "average": 1})
    )
    tasks = list(db["tasks"].find({}))
    feedbacks = list(db["feedbacks"].find({}))
    attendance_records = list(db["attendances"].find({}))
    monthly_performance = list(db["monthly_performance"].find({}))

    rows = []
    for employee in employees:
        employee_id = str(employee["_id"])
        employee_tasks = [task for task in tasks if str(task.get("assignedTo")) == employee_id]
        if employee_tasks:
            total_weight = 0.0
            overdue_count = 0
            for task in employee_tasks:
                status_key = str(task.get("status") or "").strip().lower()
                base = STATUS_WEIGHTS.get(status_key, 0.45)
                due_date = parse_datetime(task.get("dueDate"))
                is_overdue = bool(
                    due_date and due_date < datetime.now() and status_key not in {"done", "completed"}
                )
                if is_overdue:
                    overdue_count += 1
                total_weight += max(0, base - (0.2 if is_overdue else 0))
            task_efficiency = (total_weight / len(employee_tasks)) * 100
        else:
            task_efficiency = 0.0
            overdue_count = 0

        employee_feedbacks = [row for row in feedbacks if str(row.get("employeeId")) == employee_id]
        feedback_score = (
            sum(float(row.get("rating") or 0) for row in employee_feedbacks) / len(employee_feedbacks) * 20
            if employee_feedbacks
            else 0.0
        )

        employee_attendance = [
            row
            for row in attendance_records
            if str(row.get("employeeId")) == employee_id and str(row.get("date") or "").startswith(month)
        ]
        attended_weight = 0.0
        for row in employee_attendance:
            status = row.get("status")
            if status in {"Present", "WFH"}:
                attended_weight += 1
            elif status == "Late":
                attended_weight += 0.75
        attendance_score = (attended_weight / working_days * 100) if working_days else 0.0

        monthly_rows = sorted(
            [
                row
                for row in monthly_performance
                if row.get("employee") in build_employee_matcher(employee)
            ],
            key=lambda item: str(item.get("month") or ""),
        )

        rows.append(
            {
                "taskEfficiency": round(task_efficiency, 2),
                "codeScore": round(float(employee.get("average") or 0), 2),
                "feedbackScore": round(feedback_score, 2),
                "attendanceScore": round(attendance_score, 2),
                "trendDelta": calculate_trend_delta(monthly_rows),
                "totalTasks": len(employee_tasks),
                "overdueCount": overdue_count,
                "feedbackCount": len(employee_feedbacks),
                "attendanceDays": len(employee_attendance),
            }
        )

    client.close()
    return rows


def augment_rows(rows, multiplier=40):
    if not rows:
        return []

    rng = np.random.default_rng(42)
    augmented = []
    for row in rows:
        base = {name: float(row.get(name, 0) or 0) for name in FEATURE_NAMES}
        augmented.append(base)
        for _ in range(multiplier):
            jittered = {
                "taskEfficiency": np.clip(base["taskEfficiency"] + rng.normal(0, 9), 0, 100),
                "codeScore": np.clip(base["codeScore"] + rng.normal(0, 8), 0, 100),
                "feedbackScore": np.clip(base["feedbackScore"] + rng.normal(0, 9), 0, 100),
                "attendanceScore": np.clip(base["attendanceScore"] + rng.normal(0, 10), 0, 100),
                "trendDelta": np.clip(base["trendDelta"] + rng.normal(0, 6), -40, 40),
                "totalTasks": max(0, round(base["totalTasks"] + rng.normal(0, 2))),
                "overdueCount": max(0, round(base["overdueCount"] + rng.normal(0, 1.2))),
                "feedbackCount": max(0, round(base["feedbackCount"] + rng.normal(0, 1.5))),
                "attendanceDays": max(0, round(base["attendanceDays"] + rng.normal(0, 2))),
            }
            augmented.append(jittered)
    return augmented


def write_training_dataset(rows):
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    fieldnames = FEATURE_NAMES + ["recommendedAction"]
    with open(DATASET_PATH, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            csv_row = {name: row.get(name, 0) for name in FEATURE_NAMES}
            csv_row["recommendedAction"] = derive_label(row)
            writer.writerow(csv_row)


def train_model():
    os.makedirs(ARTIFACT_DIR, exist_ok=True)
    base_rows = build_current_feature_rows()
    training_rows = augment_rows(base_rows)
    if not training_rows:
        raise RuntimeError("No employee data found to train recommendation model.")

    write_training_dataset(training_rows)

    x = np.array([[row[name] for name in FEATURE_NAMES] for row in training_rows], dtype=float)
    y = np.array([derive_label(row) for row in training_rows])
    class_counts = Counter(y.tolist())
    can_stratify = len(class_counts) > 1 and min(class_counts.values()) >= 2

    test_size = 0.2 if len(training_rows) >= 20 else 0.0
    if test_size and can_stratify:
        x_train, x_test, y_train, y_test = train_test_split(
            x, y, test_size=test_size, random_state=42, stratify=y
        )
    elif test_size:
        x_train, x_test, y_train, y_test = train_test_split(
            x, y, test_size=test_size, random_state=42
        )
    else:
        x_train, y_train = x, y
        x_test, y_test = x, y

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=8,
        random_state=42,
        class_weight="balanced_subsample",
    )
    model.fit(x_train, y_train)

    predictions = model.predict(x_test)
    accuracy = float(accuracy_score(y_test, predictions)) if len(y_test) else 1.0

    joblib.dump(
        {
            "model": model,
            "feature_names": FEATURE_NAMES,
        },
        MODEL_PATH,
    )

    metadata = {
        "generatedAt": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
        "trainingSamples": int(len(training_rows)),
        "baseEmployeeSnapshots": int(len(base_rows)),
        "accuracy": round(accuracy, 4),
        "modelType": "RandomForestClassifier",
        "labelStrategy": "bootstrap-supervised",
        "classes": sorted(set(y.tolist())),
        "datasetPath": DATASET_PATH,
    }

    with open(METADATA_PATH, "w", encoding="utf-8") as handle:
        json.dump(metadata, handle)

    return metadata


def predict_rows(payload):
    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    feature_names = bundle["feature_names"]
    metadata = {}
    if os.path.exists(METADATA_PATH):
        with open(METADATA_PATH, "r", encoding="utf-8") as handle:
            metadata = json.load(handle)

    rows = payload.get("rows") or []
    if not rows:
        return {"results": [], "metadata": metadata}

    x = np.array([[float(row.get(name, 0) or 0) for name in feature_names] for row in rows], dtype=float)
    predicted_labels = model.predict(x)
    probabilities = model.predict_proba(x)

    results = []
    for index, label in enumerate(predicted_labels):
        class_index = int(np.argmax(probabilities[index]))
        confidence = float(probabilities[index][class_index])
        results.append(
            {
                "action": str(label),
                "confidence": round(confidence, 4),
            }
        )

    return {"results": results, "metadata": metadata}


def main():
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python recommendation_model.py <train|predict>")

    command = sys.argv[1]
    if command == "train":
        print(json.dumps(train_model()))
        return

    if command == "predict":
        payload = json.loads(sys.stdin.read() or "{}")
        print(json.dumps(predict_rows(payload)))
        return

    raise SystemExit(f"Unknown command: {command}")


if __name__ == "__main__":
    main()
