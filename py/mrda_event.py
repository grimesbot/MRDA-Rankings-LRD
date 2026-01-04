from datetime import datetime

class MrdaEvent:
    def __init__(self, name: str, start_dt: datetime):
        self.name = name
        self.start_dt = start_dt
        self.end_dt = start_dt

    def to_dict(self):
        result = {"start_dt": '{d.year}-{d.month}-{d.day} {d.hour}:{d.minute:02}'.format(d=self.start_dt)}
        if self.name is not None:
            result["name"] = self.name
        if self.end_dt.date() > self.start_dt.date():
            result["end_dt"] =  '{d.year}-{d.month}-{d.day} {d.hour}:{d.minute:02}'.format(d=self.end_dt)
        return result