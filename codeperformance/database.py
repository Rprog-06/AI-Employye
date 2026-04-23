# database.py

# from pymongo import MongoClient
# from config import MONGO_URI, DATABASE_NAME, COLLECTION_NAME
# from datetime import datetime

# client = MongoClient(MONGO_URI)
# db = client[DATABASE_NAME]
# collection = db[COLLECTION_NAME]

# def store_monthly_performance(df):

#     if df.empty:
#         print("No performance data to store.")
#         return

#     records = df.to_dict("records")

#     if not records:
#         print("No records found.")
#         return

#     collection.insert_many(records)
#     print("Data stored successfully.")


# from pymongo import MongoClient
# from config import MONGO_URI, DATABASE_NAME, COLLECTION_NAME
# from datetime import datetime

# # MongoDB connection
# client = MongoClient(MONGO_URI)
# db = client[DATABASE_NAME]
# collection = db[COLLECTION_NAME]


# def store_monthly_performance(df):

#     if df.empty:
#         print("No performance data to store.")
#         return

#     records = df.to_dict("records")

#     if not records:
#         print("No records found.")
#         return

#     # Add date and time to every record
#     for record in records:
#         record["created_at"] = datetime.now()

#     collection.insert_many(records)

#     print("Data stored successfully with date & time.")

#from pymongo import MongoClient
from config import MONGO_URI, DATABASE_NAME, COLLECTION_NAME

# MongoDB connection
# client = MongoClient(MONGO_URI)
# db = client[DATABASE_NAME]
# collection = db[COLLECTION_NAME]

# def store_monthly_performance(df):

#     if df.empty:
#         print("No performance data to store.")
#         return

#     # Convert dataframe to dictionary
#     records = df.to_dict("records")

#     if not records:
#         print("No records found.")
#         return

#     collection.insert_many(records)

#     print("Data stored successfully in MongoDB.")

from pymongo import MongoClient
from config import MONGO_URI, DATABASE_NAME, COLLECTION_NAME
from datetime import datetime

# MongoDB connection
client = MongoClient(MONGO_URI)
db = client[DATABASE_NAME]
collection = db[COLLECTION_NAME]


def store_monthly_performance(df):

    if df.empty:
        print("No performance data to store.")
        return

    # Add month column (for monthly performance tracking)
    df["month"] = datetime.now().strftime("%Y-%m")

    # Add timestamp column
    df["created_at"] = datetime.now()

    # Convert dataframe to dictionary records
    records = df.to_dict("records")

    if not records:
        print("No records found.")
        return

    # Insert into MongoDB
    collection.insert_many(records)

    print("Data stored successfully with month and timestamp.")