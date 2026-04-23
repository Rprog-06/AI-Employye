#main.py

from jira_service import fetch_jira_issues
from performance_engine import calculate_performance
from database import store_monthly_performance

def run():

    print("Fetching Jira Data...")
    df = fetch_jira_issues()

    print("DataFrame shape:", df.shape)
    print("Columns:", df.columns)
    print(df.head())


    print("Calculating Performance...")
    performance_df = calculate_performance(df)

    print(performance_df)

    print("Storing to MongoDB...")
    store_monthly_performance(performance_df)

    print("Process Completed Successfully.")

if __name__ == "__main__":
    run()

