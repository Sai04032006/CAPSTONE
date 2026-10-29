import cv2

from recognition.face_recognizer import FaceRecognizer


def main():

    camera = cv2.VideoCapture(0)

    recognizer = FaceRecognizer()

    print("Face detection started.")
    print("Press Q to stop.")

    while True:

        success, frame = camera.read()

        if not success:
            print("Could not read camera.")
            break

        faces = recognizer.detect_faces(frame)

        for face in faces:

            x1, y1, x2, y2 = face.bbox.astype(int)

            confidence = face.det_score

            cv2.rectangle(
                frame,
                (x1, y1),
                (x2, y2),
                (0, 255, 0),
                2
            )

            cv2.putText(
                frame,
                f"Face {confidence:.2f}",
                (x1, y1 - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (0, 255, 0),
                2
            )

        cv2.imshow(
            "Face Detection Test",
            frame
        )

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q") or key == 27:
            break

    camera.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()