import json
import os


class FaceDatabase:

    def __init__(
        self,
        database_path="data/face_database.json"
    ):

        self.database_path = database_path

        os.makedirs(
            os.path.dirname(self.database_path),
            exist_ok=True
        )

        self.database = self.load()

    def load(self):

        if not os.path.exists(self.database_path):
            return {}

        with open(
            self.database_path,
            "r",
            encoding="utf-8"
        ) as file:

            return json.load(file)

    def save(self):

        with open(
            self.database_path,
            "w",
            encoding="utf-8"
        ) as file:

            json.dump(
                self.database,
                file,
                indent=4
            )

    def add_student(
        self,
        student_id,
        name,
        embedding
    ):

        student_id = str(student_id)

        self.database[student_id] = {
            "name": name,
            "embedding": embedding.tolist()
        }

        self.save()

        print(
            f"Student {name} "
            f"({student_id}) enrolled successfully."
        )

    def get_students(self):

        return self.database