from ultralytics import YOLO


class PersonTracker:

    def __init__(self):
        self.model = YOLO("yolo11n.pt")

    def track(self, frame):
        results = self.model.track(
            frame,
            persist=True,
            classes=[0],
            verbose=False
        )

        return results[0]