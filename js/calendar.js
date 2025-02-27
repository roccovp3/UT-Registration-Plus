var color_counter = 0;
var {
    calendar_fade_time,
    button_delay
} = Timing;



var saved_courses = [];
var curr_course = {}

$("#calendar").after(Template.Calendar.modal());

chrome.storage.sync.get("savedCourses", function (data) {
    // Iterate through each saved course and add to 'event'
    saved_courses = data.savedCourses;
    console.log(saved_courses);
    let event_source = buildEventSource(saved_courses);

    $("#calendar").fullCalendar({
        editable: false, // Don't allow editing of events
        handleWindowResize: true,
        weekends: false, // will hide Saturdays and Sundays
        slotDuration: "00:30:00", // 15 minute intervals on vertical column
        slotEventOverlap: false, // No overlapping between events
        defaultView: "agendaWeek", // Only show week view
        header: false, // Hide buttons/titles
        minTime: "08:00:00", // Start time
        maxTime: "21:00:01", // End time
        columnHeaderFormat: "ddd", // Only show day of the week names
        displayEventTime: true, // Display event time
        allDaySlot: false,
        Duration: {
            hours: 1
        },
        height: 'auto',
        events: event_source,
        slotLabelFormat: [
            'h:mm A' // lower level of text
        ],
        eventRender: function (event, element, view) {
            $(element).css("padding", "5px").css("margin-bottom", "5px");
        },
        eventClick: function (data, event, view) {
            displayModal(data)
        }
    });
});

function displayModal(data) {
    $("#myModal").fadeIn(calendar_fade_time);
    $("#colorStrip").css('background-color', data.color);
    curr_course = saved_courses[data.index];
    setUpModal()
}

function setUpModal() {
    let {
        coursename,
        unique,
        datetimearr,
        profname,
        status,
        registerlink
    } = curr_course;
    buildTimeTitle(datetimearr);
    if(!unique.includes("custom")) {
        $("#prof").html(`with <span style='font-weight:bold;'>${capitalizeString(profname)}</span>`);
        $("#classname").html(`${coursename} <span style='font-size:small'>(${unique})</span>`);
        $("#register").css("display", "inline");
        $("#info").css("display", "inline");
        $("#remove").css("margin-left", "10px");
        setRegisterButton(status, registerlink);
    } else {
        $("#prof").html("");
        $("#classname").html(`${coursename}`);
        $("#register").css("display", "none");
        $("#info").css("display", "none");
        $("#remove").css("margin-left", "0px");
    }
}

function setRegisterButton(status, registerlink) {
    if (canNotRegister(status, registerlink))
        $("#register").text("Can't Register").css("background-color", Colors.closed);
    else if (status.includes("waitlisted"))
        $("#register").text("Join Waitlist").css("background-color", Colors.waitlisted);
    else
        $("#register").text("Register").css("background-color", Colors.open);
}

function buildTimeTitle(datetimearr) {
    $('#timelines').remove();
    var arr = convertDateTimeArrToLine(datetimearr)
    var output = "";
    for (let i = 0; i < arr.length; i++) {
        let line = arr[i];
        output += Template.Calendar.line(line);
    }
    $("#header").after(`<div id='timelines'>${output}</div`);
}


// Iterate through each saved course and add to 'event'
function buildEventSource(saved_courses) {
    color_counter = 0;
    let event_source = [];
    var hours = 0;
    for (let i = 0; i < saved_courses.length; i++) {
        let {
            coursename,
            datetimearr
        } = saved_courses[i];
        let number = separateCourseNameParts(coursename).number;
        let class_length = parseInt(number.charAt(0));
        let multi_semester_code = number.slice(-1);
        if (["A","B"].includes(multi_semester_code)) {
            hours += Math.floor(class_length/2);
        } else if (["X","Y","Z"].includes(multi_semester_code)) {
            hours += Math.floor(class_length/3);
        } else if (saved_courses[i].unique.includes("custom")) {
            hours += 0;
        } else {
            hours += class_length;
        }
        for (let j = 0; j < datetimearr.length; j++) {
            let session = datetimearr[j]; // One single session for a class
            let event_obj = setEventForSection(session, color_counter, i);
            event_source.push(event_obj);
        }
        color_counter++;
    }
    displayMetaData(hours, saved_courses);
    return event_source;
}

function displayMetaData(hours, saved_courses) {
    $("#hours").text(hours + " Hours");
    $("#num").text(saved_courses.length + " Courses");
}

//create the event object for every section
function setEventForSection(session, colorCounter, i) {
    let full_day = days.get(session[0]);
    let course = saved_courses[i];
    let {
        coursename,
        profname,
    } = course;
    let {
        department,
        number
    } = separateCourseNameParts(coursename)
    beg_day = calculateBeginningDate(full_day)
    start_date = formatCalculateDate(beg_day, full_day, session[1][0]);
    end_date = formatCalculateDate(beg_day, full_day, session[1][1]);

    event_obj = {
        title: `${department}-${number} with ${capitalizeString(profname)}`,
        start: start_date,
        end: end_date,
        color: Colors.material_colors[colorCounter],
        building: session[2],
        index: i,
        allday: false
    };

    if(course.unique.includes("custom")) {
        event_obj.title = `${coursename}`;
    }

    return event_obj;
}

function formatCalculateDate(beg_day, full_day, hour) {
    return beg_day + moment().day(full_day)._d.toString().split(" ")[2] + "T" + hour + ":00";
}

function calculateBeginningDate(full_day) {
    var year = moment().day(full_day)._d.toString().split(" ")[3];
    var month_num = moment(moment().day(full_day)._d.toString().split(" ")[1], "MMM").format('MM');
    return `${year}-${month_num}-`;
}

function updateCalendar() {
    chrome.storage.sync.get("savedCourses", function (data) {
        saved_courses = data.savedCourses
        let event_source = buildEventSource(saved_courses);
        $('#calendar').fullCalendar('removeEventSources');
        $("#calendar").fullCalendar('addEventSource', event_source, true);
    });
}
chrome.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
        if (request.command == "updateCourseList" || request.command == "courseAdded") {
            updateCalendar();
        }
    }
);


$("#info").click(() => {
    openMoreInfoWithOpenModal(curr_course.link);
});


$("#save").click(() => {
    takePicture();
});


$("#clear").click(() => {
    /*Clear the list and the storage of courses*/
    chrome.storage.sync.set({
        savedCourses: []
    });
    updateAllTabsCourseList();
    updateCalendar();
});


$("#remove").click(() => {
    setTimeout(() => {
        chrome.runtime.sendMessage({
            command: "courseStorage",
            course: curr_course,
            action: "remove"
        }, function () {
            $("#myModal").fadeOut(calendar_fade_time);
            updateCalendar();
            updateAllTabsCourseList();
        });
    }, button_delay);
});


$("#register").click(function () {
    let {
        registerlink,
        status
    } = curr_course;
    if (!canNotRegister(status, registerlink)) {
        setTimeout(() => {
            window.open(registerlink);
        }, button_delay);
    }
});

$("#export").click(function () {
    var cal = ics();
    var calendarEvents = $('#calendar').fullCalendar('clientEvents');
    for (i in calendarEvents) {
        var event = calendarEvents[i];
        buildICSFile(cal, event);
    }
    cal.download("My_Course_Calendar");
});

$("#addblock").click(function () {
    var startTime = document.getElementById("starttimeselect").value;
    var endTime = document.getElementById("endtimeselect").value;
    var fullName = document.getElementById("nameselect").value;

    selectedDays = getSelectedDays();

    if (startTime != "" && endTime != "") {
        let unique = "custom"+selectedDays.toString()+startTime+endTime+fullName;
        let prof_name = "";
        let dtarr = [];
        for(var i = 0; i < selectedDays.length; i++) {
            dtarr.push([selectedDays[i],[startTime, endTime],""])
        }
    
        var c = new Course(fullName, unique, prof_name, dtarr, "", "", "");
        chrome.runtime.sendMessage({
            command: "courseStorage",
            course: c,
            action: "add"
        }, function (response) {
            chrome.runtime.sendMessage({
                command: "updateCourseList"
            });
        });
    }
});

function getSelectedDays() {
    var checkboxes = document.getElementsByName('day');
    var selectedDays = [];

    for (var i = 0; i < checkboxes.length; i++) {
        if (checkboxes[i].checked) {
            selectedDays.push(checkboxes[i].value);
        }
    }

    console.log("Selected Days: " + selectedDays.join(', '));
    return selectedDays;
}

function getSelectedValues() {
    

    console.log("Selected Day: " + selectedDay);
    console.log("Start Time: " + startTime);
    console.log("End Time: " + endTime);
}

function buildICSFile(cal, event) {
    let {
        title,
        start,
        end,
        building
    } = event;
    let class_name = title.split('with')[0];
    let description = `with ${title.split('with')[1]}`;
    let time = start._d.toUTCString();
    cal.addEvent(class_name, description, building, start._i, end._i, {
        rrule: `RRULE:FREQ=WEEKLY;BYDAY=${time.substring(0, time.indexOf(",") - 1).toUpperCase()};INTERVAL=1`
    });
}

function takePicture() {
    var width = $("#calendar").width();
    var height = $("#calendar").height();
    let cropper = document.createElement('canvas').getContext('2d');
    html2canvas(document.querySelector("#calendar"), Export.png_options).then(c => {
        cropper.canvas.width = width;
        cropper.canvas.height = height;
        cropper.drawImage(c, 0, 0);
        var a = document.createElement('a');
        a.href = cropper.canvas.toDataURL("image/png");
        a.download = 'mySchedule.png';
        a.click();
    });
}


/*Close Modal when hit escape*/
$(document).keydown((e) => {
    if (e.keyCode == 27) {
        $("#myModal").fadeOut(calendar_fade_time);
    }
});

$('.close').click(function () {
    close();
});
$('#myModal').click(function (event) {
    if (event.target.id == 'myModal') {
        close();
    }
});

function close() {
    $("#myModal").fadeOut(calendar_fade_time);
}