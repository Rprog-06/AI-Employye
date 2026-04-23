# performance_engine.py

import pandas as pd

def calculate_performance(df):
    if df.empty:
        print("No Jira issues found. Please create tasks.")
        return df
    # Convert dates
    # Force both columns to UTC so subtraction never mixes tz-aware/tz-naive values.
    df["created"] = pd.to_datetime(df["created"], utc=True, errors="coerce")
    df["resolved"] = pd.to_datetime(df["resolved"], utc=True, errors="coerce")

    # Status score
    status_score = {
        "Done": 1,
        "In Progress": 0.5,
        "To Do": 0
    }

    df["status_score"] = df["status"].map(status_score).fillna(0)

    # Priority score
    priority_score = {
        "Highest": 5,
        "High": 4,
        "Medium": 3,
        "Low": 2,
        "Lowest": 1
    }

    df["priority_score"] = df["priority"].map(priority_score).fillna(1)

    # Delay calculation
    df["delay_days"] = (df["resolved"] - df["created"]).dt.days
    df["delay_days"] = df["delay_days"].fillna(0).apply(lambda x: x if x > 0 else 0)

    # Productivity
    df["productivity"] = df["story_points"] / (df["time_spent"] + 1)

    # Final weighted score
    df["task_score"] = (
        0.4 * df["productivity"] +
        0.3 * df["status_score"] +
        0.2 * df["priority_score"] -
        0.1 * df["delay_days"]
    )

    # Employee-wise aggregation
    performance = df.groupby("employee").agg({
        "task_score": "sum",
        "story_points": "sum",
        "time_spent": "sum",
        "priority": "first"
    }).reset_index()

    performance.rename(columns={"task_score": "performance_score"}, inplace=True)

    return performance
