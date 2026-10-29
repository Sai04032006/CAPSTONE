
import json
from pathlib import Path

from sqlalchemy import text
from pgvector.sqlalchemy import Vector

from backend.database.database import engine

JSON_PATH = Path(
    r"D:\SmartClassroom\SmartClassroomAnalytics\ai\data\face_database.json"
)

DIMENSIONS = 512


def main():
    with JSON_PATH.open("r", encoding="utf-8") as file:
        students = json.load(file)

    if not students:
        raise RuntimeError("No students found in JSON database.")

    # Validate everything before writing to PostgreSQL.
    records = []

    for student_id, data in students.items():
        embedding = data.get("embedding")

        if not isinstance(embedding, list) or len(embedding) != DIMENSIONS:
            raise ValueError(
                f"Invalid embedding dimensions for student {student_id}"
            )

        records.append({
            "student_id": str(student_id),
            "student_name": data["name"],
            "embedding": embedding,
        })

    with engine.begin() as connection:
        connection.execute(text("""
            CREATE TABLE IF NOT EXISTS face_embeddings (
                student_id VARCHAR(50) PRIMARY KEY,
                student_name TEXT NOT NULL,
                embedding VECTOR(512) NOT NULL,
                updated_at TIMESTAMPTZ DEFAULT NOW()
            )
        """))

        # Insert new records or update existing records for the same ID.
        for record in records:
            connection.execute(
                text("""
                    INSERT INTO face_embeddings
                        (student_id, student_name, embedding)
                    VALUES
                        (:student_id, :student_name, :embedding)
                    ON CONFLICT (student_id)
                    DO UPDATE SET
                        student_name = EXCLUDED.student_name,
                        embedding = EXCLUDED.embedding,
                        updated_at = NOW()
                """).bindparams(
                    # SQLAlchemy needs an explicit vector type for binding.
                    __import__(
                        "sqlalchemy"
                    ).bindparam(
                        "embedding",
                        type_=Vector(DIMENSIONS)
                    )
                ),
                record,
            )

        total = connection.execute(
            text("SELECT COUNT(*) FROM face_embeddings")
        ).scalar_one()

        print(f"JSON records processed: {len(records)}")
        print(f"Total rows in face_embeddings: {total}")

        if total < len(records):
            raise RuntimeError("Verification failed: expected rows are missing.")

    print("Migration completed. JSON backup was not modified.")


if __name__ == "__main__":
    main()
