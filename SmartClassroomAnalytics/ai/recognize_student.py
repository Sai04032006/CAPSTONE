import cv2
import numpy as np

from recognition.face_recognizer import FaceRecognizer
from recognition.face_database import FaceDatabase


def cosine_similarity(a, b):

    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)

    denominator = (
        np.linalg.norm(a) *
        np.linalg.norm(b)
    )

    if denominator == 0:
        return 0.0

    return float(
        np.dot(a, b) / denominator
    )


def recognize_face(face, students, threshold=0.45):

    if not students:
        return "Unknown", None, 0.0

    current_embedding = face.embedding

    current_embedding = (
        current_embedding /
        np.linalg.norm(current_embedding)
    )

    best_name = "Unknown"
    best_student_id = None
    best_score = -1.0

    for student_id, student_data in students.items():

        stored_embedding = np.array(
            student_data["embedding"],
            dtype=np.float32
        )

        score = cosine_similarity(
            current_embedding,
            stored_embedding
        )

        if score > best_score:

            best_score = score
            best_name = student_data["name"]
            best_student_id = student_id

    if best_score < threshold:

        return (
            "Unknown",
            None,
            best_score
        )

    return (
        best_name,
        best_student_id,
        best_score
    )


def main():

    print("=" * 55)
    print("              STUDENT RECOGNITION")
    print("=" * 55)

    # -----------------------------
    # Load face recognition model
    # -----------------------------

    recognizer = FaceRecognizer()

    # -----------------------------
    # Load enrolled students
    # -----------------------------

    database = FaceDatabase()

    students = database.get_students()

    print(
        f"Registered students: {len(students)}"
    )

    if not students:

        print(
            "ERROR: No students enrolled."
        )

        print(
            "Run enroll_student.py first."
        )

        return

    # -----------------------------
    # Start camera
    # -----------------------------

    camera = cv2.VideoCapture(0)

    if not camera.isOpened():

        print("ERROR: Could not open camera.")

        return

    print()
    print("Recognition started.")
    print("Look at the camera.")
    print("Press Q to stop.")
    print()

    while True:

        success, frame = camera.read()

        if not success:

            print("Could not read camera.")

            break

        # -------------------------
        # Detect faces
        # -------------------------

        faces = recognizer.detect_faces(
            frame
        )

        # -------------------------
        # Recognize each face
        # -------------------------

        for face in faces:

            x1, y1, x2, y2 = (
                face.bbox.astype(int)
            )

            name, student_id, score = (
                recognize_face(
                    face,
                    students
                )
            )

            # ---------------------
            # Known student
            # ---------------------

            if student_id is not None:

                label = (
                    f"{name} | "
                    f"{student_id} | "
                    f"{score:.2f}"
                )

            # ---------------------
            # Unknown person
            # ---------------------

            else:

                label = (
                    f"Unknown | "
                    f"{score:.2f}"
                )

            # ---------------------
            # Draw face box
            # ---------------------

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )

            # ---------------------
            # Draw identity
            # ---------------------

            cv2.putText(
                frame,
                label,
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 255, 0),
                2
            )

        # -------------------------
        # Display
        # -------------------------

        cv2.imshow(
            "Student Recognition",
            frame
        )

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q") or key == 27:

            break

    camera.release()

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()