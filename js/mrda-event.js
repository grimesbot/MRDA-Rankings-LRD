class MrdaEvent {
    constructor(eventId, event) {
        this.eventId = eventId;
        this.startDt = event.start_dt instanceof Date ? event.start_dt : new Date(event.start_dt);
        this.endDt = event.end_dt ? new Date(event.end_dt) : this.startDt;
        this.name = event.name;
    }

    getDateString() {
        // Single day events
        if (this.startDt == this.endDt){
            // If the single day event has a title, return the date but don't include the weekday for brevity
            if (this.name)
                return this.startDt.toLocaleDateString(undefined,{year:'numeric',month:'long',day:'numeric'});
            else
                return this.startDt.toLocaleDateString(undefined,{weekday:'long',year:'numeric',month:'long',day:'numeric'});
        } else {
        // Multi-day events use short month for brevity
            let dtFmtOpts = {year:'numeric',month:'short',day:'numeric'};
            let dateStr = this.startDt.toLocaleDateString(undefined,dtFmtOpts);            
            if (this.startDt.getFullYear() != this.endDt.getFullYear())
                return `${dateStr} - ${this.endDt.toLocaleDateString(undefined,dtFmtOpts)}`;
            else if (this.startDt.getMonth() != this.endDt.getMonth()) {
                dtFmtOpts = {month:'short',day:'numeric'};
                let monthAndDay = this.startDt.toLocaleDateString(undefined,dtFmtOpts);
                return dateStr.replace(monthAndDay, `${monthAndDay} - ${this.endDt.toLocaleDateString(undefined,dtFmtOpts)}`);
            } else {
                dtFmtOpts = {day:'numeric'};
                let day = this.startDt.toLocaleDateString(undefined,dtFmtOpts);
                return dateStr.replace(new RegExp(`\\b${day}\\b`, 'g'), `${day}-${this.endDt.toLocaleDateString(undefined,dtFmtOpts)}`);
            }
        }
    }

    getEventTitle() {
        // Single day events
        if (this.startDt == this.endDt) {
            if (this.name)
                return `${this.getDateString()}: ${this.name}`;
            else
                return this.getDateString();
        } else {
        // Multi-day events
            if (this.name)
                return this.name;
            else 
                return this.getDateString();
        }
    }

    getShortName() {
        return this.name ? this.name.replace('Mens Roller Derby Association', 'MRDA')
                                .replace('Men\'s Roller Derby Association', 'MRDA')
                                .replace(this.startDt.getFullYear(),'').trim() : null;
    }

    getEventTitleWithDate() {
        if (this.name){
            let niceName = this.getShortName();
            return `${this.getDateString()}: ${niceName}`;
        } else
            return this.getDateString();
    }
}