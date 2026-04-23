# # jira_service.py

# import requests
# from requests.auth import HTTPBasicAuth
# import pandas as pd
# from config import JIRA_EMAIL, JIRA_API_TOKEN, JIRA_DOMAIN, JIRA_PROJECT_KEY


# def fetch_jira_issues():

#     url = f"https://{JIRA_DOMAIN}/rest/api/3/search/jql"

#     auth = HTTPBasicAuth(JIRA_EMAIL, JIRA_API_TOKEN)

#     headers = {
#         "Accept": "application/json",
#         "Content-Type": "application/json"
#     }

#     query = {
#         "jql": "project = KAN",
#         "maxResults": 50,
#         "fields": [
#             "assignee",
#             "status",
#             "priority",
#             "created",
#             "resolutiondate",
#             "timespent",
#             "customfield_10016"
#         ]
#     }

#     response = requests.post(
#         url,
#         headers=headers,
#         json=query,
#         auth=auth
#     )

#     print("Status Code:", response.status_code)
#     print("Response Text:", response.text)

#     if response.status_code != 200:
#         return pd.DataFrame()

#     data = response.json()
#     issues = data.get("issues", [])

#     return convert_to_dataframe(issues)


    




# def convert_to_dataframe(issues):

#     if not issues:
#         return pd.DataFrame()

#     records = []

#     for issue in issues:
#         fields = issue.get("fields", {})

#         assignee = fields.get("assignee")
#         priority = fields.get("priority")
#         status = fields.get("status")

#         records.append({
#             "employee": assignee.get("displayName") if assignee else "Unassigned",
#             "story_points": fields.get("customfield_10016") or 0,
#             "status": status.get("name") if status else "Unknown",
#             "priority": priority.get("name") if priority else "None",
#             "time_spent": (fields.get("timespent") or 0) / 3600,
#             "created": fields.get("created"),
#             "resolved": fields.get("resolutiondate")
#         })

#     return pd.DataFrame(records)

# jira_service.py

import requests
from requests.auth import HTTPBasicAuth
import pandas as pd
from config import JIRA_EMAIL, JIRA_API_TOKEN, JIRA_DOMAIN, JIRA_PROJECT_KEY


def fetch_jira_issues():

    url = f"https://{JIRA_DOMAIN}/rest/api/3/search/jql"

    auth = HTTPBasicAuth(JIRA_EMAIL, JIRA_API_TOKEN)

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json"
    }

    query = {
        "jql": "project = KAN",
        "maxResults": 50,
        "fields": [
            "assignee",
            "status",
            "priority",
            "created",
            "resolutiondate",
            "timespent",
            "customfield_10016"
        ]
    }

    response = requests.post(
        url,
        headers=headers,
        json=query,
        auth=auth
    )

    print("Status Code:", response.status_code)

    if response.status_code != 200:
        return pd.DataFrame()

    data = response.json()
    issues = data.get("issues", [])

    df = convert_to_dataframe(issues)

    # ⭐ Save data to CSV (for reporting / guide demo)
    df.to_csv("jira_issues_report.csv", index=False)

    print("CSV file saved: jira_issues_report.csv")

    return df


def convert_to_dataframe(issues):

    if not issues:
        return pd.DataFrame()

    records = []

    for issue in issues:
        fields = issue.get("fields", {})

        assignee = fields.get("assignee")
        priority = fields.get("priority")
        status = fields.get("status")

        records.append({
            "employee": assignee.get("displayName") if assignee else "Unassigned",
            "story_points": fields.get("customfield_10016") or 0,
            "status": status.get("name") if status else "Unknown",
            "priority": priority.get("name") if priority else "None",
            "time_spent": (fields.get("timespent") or 0) / 3600,
            "created": fields.get("created"),
            "resolved": fields.get("resolutiondate")
        })

    return pd.DataFrame(records)