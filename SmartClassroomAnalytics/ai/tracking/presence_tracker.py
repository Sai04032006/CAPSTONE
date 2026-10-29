from datetime import datetime


class PresenceTracker:

    def __init__(self):
        self.tracks = {}

    def update(self, track_ids):

        current_time = datetime.now()

        for track_id in track_ids:

            if track_id not in self.tracks:

                self.tracks[track_id] = {
                    "first_seen": current_time,
                    "last_seen": current_time,
                    "active": True
                }

                print(
                    f"[ENTRY] Track ID {track_id} "
                    f"entered at {current_time.strftime('%H:%M:%S')}"
                )

            else:

                self.tracks[track_id]["last_seen"] = current_time
                self.tracks[track_id]["active"] = True

    def get_presence_time(self, track_id):

        if track_id not in self.tracks:
            return 0

        first_seen = self.tracks[track_id]["first_seen"]
        last_seen = self.tracks[track_id]["last_seen"]

        duration = last_seen - first_seen

        return duration.total_seconds()