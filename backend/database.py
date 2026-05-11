import mysql.connector
import os


def get_db():
    """Return a new mysql.connector connection using environment variables.
    Caller is responsible for calling conn.close() after use.
    """
    return mysql.connector.connect(
        host=os.environ.get("DB_HOST", "localhost"),
        database=os.environ.get("DB_NAME", "jira_db"),
        user=os.environ.get("DB_USER", "root"),
        password=os.environ.get("DB_PASSWORD", ""),
    )
