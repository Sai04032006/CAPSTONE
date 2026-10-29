import cv2
import numpy as np

from recognition.face_recognizer import FaceRecognizer
from recognition.face_database import FaceDatabase


def main():

    student_id = input(
        "Enter student ID: "
    ).strip()

    student_name = input(
        "Enter student name: "
    ).strip()

    recognizer = FaceRecognizer()
    database = FaceDatabase()

    camera = cv2.VideoCapture(0)

    print()
    print("Enrollment started.")
    print("Look directly at the camera.")
    print("Press SPACE to capture your face.")
    print("Press Q to cancel.")

    while True:

        success, frame = camera.read()

        if not success:
            print("Could not read camera.")
            break

        faces = recognizer.detect_faces(frame)

        for face in faces:

            x1, y1, x2, y2 = (
                face.bbox.astype(int)
            )

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )

            cv2.putText(
                frame,
                "Face detected",
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.7,
                (0, 255, 0),
                2
            )

        cv2.imshow(
            "Student Enrollment",
            frame
        )

        key = cv2.waitKey(1) & 0xFF

        # Capture
        if key == ord(" "):

            if len(faces) == 0:

                print(
                    "No face detected. "
                    "Try again."
                )

                continue

            if len(faces) > 1:

                print(
                    "Multiple faces detected. "
                    "Only one person should be "
                    "in the frame."
                )

                continue

            face = faces[0]

            embedding = face.embedding

            # Normalize embedding
            embedding = (
                embedding /
                np.linalg.norm(embedding)
            )

            database.add_student(
                student_id,
                student_name,
                embedding
            )

            break

        # Quit
        if key == ord("q") or key == 27:

            print("Enrollment cancelled.")
            break

    camera.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()