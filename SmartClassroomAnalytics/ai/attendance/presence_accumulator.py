import time


class PresenceAccumulator:

    def __init__(
        self,
        class_duration_minutes=50,
        attendance_threshold=0.70
    ):

        # ---------------------------------------------
        # CLASS CONFIGURATION
        # ---------------------------------------------

        self.class_duration_seconds = (
            class_duration_minutes * 60
        )

        self.attendance_threshold = (
            attendance_threshold
        )

        # Required presence time
        self.required_presence_seconds = (
            self.class_duration_seconds
            * self.attendance_threshold
        )

        # ---------------------------------------------
        # CLASS SESSION
        # ---------------------------------------------

        self.class_started = False

        self.class_start_time = None

        # ---------------------------------------------
        # STUDENT DATA
        # ---------------------------------------------

        self.students = {}

    # =================================================
    # START CLASS
    # =================================================

    def start_class(self):

        self.class_started = True

        self.class_start_time = time.time()

        print()
        print("=" * 60)
        print("CLASS SESSION STARTED")
        print("=" * 60)

        print(
            f"Class duration : "
            f"{self.class_duration_seconds / 60:.0f} minutes"
        )

        print(
            f"Attendance threshold : "
            f"{self.attendance_threshold * 100:.0f}%"
        )

        print(
            f"Required presence : "
            f"{self.required_presence_seconds / 60:.2f} minutes"
        )

        print("=" * 60)

    # =================================================
    # REGISTER STUDENT
    # =================================================

    def register_student(
        self,
        student_id,
        name
    ):

        student_id = str(student_id)

        if student_id not in self.students:

            self.students[student_id] = {

                "name": name,

                "total_presence_seconds": 0.0,

                "currently_present": False,

                "last_seen_time": None,

                "presence_start_time": None
            }

    # =================================================
    # UPDATE STUDENT PRESENCE
    # =================================================

    def update_presence(
        self,
        student_id,
        name,
        is_present,
        current_time=None
    ):

        if not self.class_started:

            return

        if current_time is None:

            current_time = time.time()

        student_id = str(student_id)

        # ---------------------------------------------
        # Make sure student exists
        # ---------------------------------------------

        self.register_student(
            student_id,
            name
        )

        student = self.students[
            student_id
        ]

        # =================================================
        # STUDENT IS CURRENTLY VISIBLE
        # =================================================

        if is_present:

            # -----------------------------------------
            # Student has just appeared
            # -----------------------------------------

            if not student["currently_present"]:

                student[
                    "presence_start_time"
                ] = current_time

                student[
                    "currently_present"
                ] = True

            # -----------------------------------------
            # Update last seen
            # -----------------------------------------

            student[
                "last_seen_time"
            ] = current_time

        # =================================================
        # STUDENT IS NOT CURRENTLY VISIBLE
        # =================================================

        else:

            if student["currently_present"]:

                start_time = (
                    student[
                        "presence_start_time"
                    ]
                )

                if start_time is not None:

                    duration = (
                        current_time
                        - start_time
                    )

                    student[
                        "total_presence_seconds"
                    ] += duration

                student[
                    "currently_present"
                ] = False

                student[
                    "presence_start_time"
                ] = None

                student[
                    "last_seen_time"
                ] = current_time

    # =================================================
    # FINALIZE CURRENT PRESENCE
    # =================================================

    def finalize_presence(
        self,
        current_time=None
    ):

        if current_time is None:

            current_time = time.time()

        for student_id, student in (
            self.students.items()
        ):

            if student["currently_present"]:

                start_time = (
                    student[
                        "presence_start_time"
                    ]
                )

                if start_time is not None:

                    duration = (
                        current_time
                        - start_time
                    )

                    student[
                        "total_presence_seconds"
                    ] += duration

                    student[
                        "presence_start_time"
                    ] = current_time

    # =================================================
    # CALCULATE ATTENDANCE
    # =================================================

    def calculate_attendance(self):

        self.finalize_presence()

        results = {}

        for student_id, student in (
            self.students.items()
        ):

            total_presence = (
                student[
                    "total_presence_seconds"
                ]
            )

            percentage = (
                total_presence
                / self.class_duration_seconds
            ) * 100

            if (
                total_presence
                >= self.required_presence_seconds
            ):

                status = "PRESENT"

            else:

                status = "ABSENT"

            results[student_id] = {

                "name": student["name"],

                "total_presence_seconds":
                    total_presence,

                "presence_minutes":
                    total_presence / 60,

                "presence_percentage":
                    percentage,

                "status":
                    status
            }

        return results

    # =================================================
    # PRINT FINAL ATTENDANCE
    # =================================================

    def print_attendance(self):

        results = (
            self.calculate_attendance()
        )

        print()
        print("=" * 70)
        print("                 FINAL ATTENDANCE")
        print("=" * 70)

        print(
            f"Class duration : "
            f"{self.class_duration_seconds / 60:.0f} minutes"
        )

        print(
            f"Required presence : "
            f"{self.required_presence_seconds / 60:.2f} minutes"
        )

        print(
            f"Threshold : "
            f"{self.attendance_threshold * 100:.0f}%"
        )

        print("-" * 70)

        for student_id, data in (
            results.items()
        ):

            print(
                f"Student : {data['name']}"
            )

            print(
                f"ID      : {student_id}"
            )

            print(
                f"Presence: "
                f"{data['presence_minutes']:.2f} minutes"
            )

            print(
                f"Percentage: "
                f"{data['presence_percentage']:.2f}%"
            )

            print(
                f"Status  : {data['status']}"
            )

            print("-" * 70)

        print("=" * 70)