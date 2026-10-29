import cv2

from camera.webcam import Webcam
from tracking.person_tracker import PersonTracker
from tracking.presence_tracker import PresenceTracker


def main():

    webcam = Webcam()
    tracker = PersonTracker()
    presence_tracker = PresenceTracker()

    print("Camera started.")
    print("Person tracking started.")
    print("Presence tracking started.")
    print("Press Q to stop.")

    while True:

        # Get frame
        frame = webcam.read()

        # YOLO tracking
        result = tracker.track(frame)

        # Get tracking IDs
        track_ids = []

        if result.boxes.id is not None:

            track_ids = (
                result.boxes.id
                .int()
                .cpu()
                .tolist()
            )

        # Update presence information
        presence_tracker.update(track_ids)

        # Draw bounding boxes and IDs
        annotated_frame = result.plot()

        # Display
        cv2.imshow(
            "Smart Classroom - Tracking",
            annotated_frame
        )

        key = cv2.waitKey(1) & 0xFF

        if key == ord("q") or key == 27:
            break

    webcam.release()

    # Print final presence information
    print("\n========== PRESENCE SUMMARY ==========")

    for track_id, data in presence_tracker.tracks.items():

        duration = (
            data["last_seen"] -
            data["first_seen"]
        ).total_seconds()

        print(
            f"Track ID {track_id}: "
            f"{duration:.2f} seconds"
        )


if __name__ == "__main__":
    main()