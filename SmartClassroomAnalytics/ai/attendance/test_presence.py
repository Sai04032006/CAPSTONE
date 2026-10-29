from presence_accumulator import PresenceAccumulator


tracker = PresenceAccumulator(
    class_duration_minutes=50,
    attendance_threshold=0.70
)


tracker.class_started = True
tracker.class_start_time = 0


student_id = "2300033017"
student_name = "P. Sai Lokesh"


# -----------------------------------------
# Present: 0 → 10 minutes
# -----------------------------------------

tracker.update_presence(
    student_id,
    student_name,
    True,
    current_time=0
)

tracker.update_presence(
    student_id,
    student_name,
    False,
    current_time=10 * 60
)


# -----------------------------------------
# Absent: 10 → 15 minutes
# -----------------------------------------


# -----------------------------------------
# Present: 15 → 30 minutes
# -----------------------------------------

tracker.update_presence(
    student_id,
    student_name,
    True,
    current_time=15 * 60
)

tracker.update_presence(
    student_id,
    student_name,
    False,
    current_time=30 * 60
)


# -----------------------------------------
# Absent: 30 → 35 minutes
# -----------------------------------------


# -----------------------------------------
# Present: 35 → 48 minutes
# -----------------------------------------

tracker.update_presence(
    student_id,
    student_name,
    True,
    current_time=35 * 60
)

tracker.update_presence(
    student_id,
    student_name,
    False,
    current_time=48 * 60
)


tracker.print_attendance()