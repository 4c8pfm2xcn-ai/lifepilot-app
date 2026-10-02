"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin, { Draggable, type EventReceiveArg, type EventResizeDoneArg } from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import type { DateSelectArg, EventClickArg, EventDropArg, EventInput, DatesSetArg } from "@fullcalendar/core";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { useData } from "@/providers/data-provider";
import { useUI } from "@/providers/ui-provider";
import { addDaysKey, localKey } from "@/lib/time";
import { busyForRange, findConflicts, type Busy } from "@/lib/planner";

export type CalView = "dayGridMonth" | "timeGridWeek" | "timeGridDay" | "listWeek";

export interface CalendarHandle {
  prev: () => void;
  next: () => void;
  today: () => void;
  changeView: (v: CalView) => void;
}

export interface PendingMove {
  kind: "event" | "task";
  id: string;
  title: string;
  start: Date;
  end: Date;
  conflicts: Busy[];
  revert: () => void;
}

interface Props {
  view: CalView;
  showDeadlines: boolean;
  onTitle: (title: string) => void;
  onConflict: (move: PendingMove) => void;
  onSelectRange: (start: Date, end: Date, allDay: boolean) => void;
  externalRef: React.RefObject<HTMLElement | null>;
}

export const CalendarView = forwardRef<CalendarHandle, Props>(function CalendarView({ view, showDeadlines, onTitle, onConflict, onSelectRange, externalRef }, ref) {
  const { events, tasks, profile, updateEvent, updateTask } = useData();
  const ui = useUI();
  const calRef = useRef<FullCalendar>(null);
  const prefs = profile?.preferences;

  useImperativeHandle(ref, () => ({
    prev: () => calRef.current?.getApi().prev(),
    next: () => calRef.current?.getApi().next(),
    today: () => calRef.current?.getApi().today(),
    changeView: (v) => calRef.current?.getApi().changeView(v),
  }));

  useEffect(() => {
    const api = calRef.current?.getApi();
    if (api && api.view.type !== view) api.changeView(view);
  }, [view]);

  // Drag unscheduled tasks from the side list onto the calendar.
  useEffect(() => {
    const el = externalRef.current;
    if (!el) return;
    const d = new Draggable(el, {
      itemSelector: "[data-drag-task]",
      eventData: (node) => {
        const id = node.getAttribute("data-drag-task")!;
        const t = tasks.find((x) => x.id === id);
        const mins = Math.min(t?.estimated_minutes ?? 30, 180);
        return { id: `task:${id}`, title: t?.title ?? "Task", duration: { minutes: mins }, classNames: ["dz-task"], extendedProps: { kind: "task", refId: id }, create: true };
      },
    });
    return () => d.destroy();
  }, [externalRef, tasks]);

  const items = useMemo<EventInput[]>(() => {
    const out: EventInput[] = events.map((e) => ({
      id: `event:${e.id}`,
      title: e.title,
      start: e.start_at,
      end: e.end_at,
      allDay: e.all_day,
      classNames: ["dz-event"],
      extendedProps: { kind: "event", refId: e.id, location: e.location },
    }));
    for (const t of tasks) {
      if (t.scheduled_start && t.scheduled_end) {
        out.push({ id: `task:${t.id}`, title: t.title, start: t.scheduled_start, end: t.scheduled_end, classNames: ["dz-task", t.status === "done" ? "dz-task-done" : ""], extendedProps: { kind: "task", refId: t.id } });
      }
      if (showDeadlines && t.due_at && t.status !== "done") {
        const key = localKey(new Date(t.due_at));
        out.push({ id: `due:${t.id}`, title: `Due: ${t.title}`, start: key, end: addDaysKey(key, 1), allDay: true, editable: false, classNames: ["dz-deadline"], extendedProps: { kind: "deadline", refId: t.id } });
      }
    }
    return out;
  }, [events, tasks, showDeadlines]);

  const checkMove = (kind: "event" | "task", id: string, title: string, start: Date, end: Date, revert: () => void, commit: () => void) => {
    const excludeTasks = new Set(kind === "task" ? [id] : []);
    const others = kind === "event" ? events.filter((e) => e.id !== id) : events;
    const clashes = findConflicts(start.getTime(), end.getTime(), busyForRange(start.getTime(), end.getTime(), others, tasks, excludeTasks));
    if (clashes.length) onConflict({ kind, id, title, start, end, conflicts: clashes, revert });
    else commit();
  };

  const onDrop = (arg: EventDropArg | EventResizeDoneArg) => {
    const { kind, refId } = arg.event.extendedProps as { kind: string; refId: string };
    const start = arg.event.start!;
    const end = arg.event.end ?? new Date(start.getTime() + 3600000);
    if (kind === "event") {
      const allDay = arg.event.allDay;
      const commit = () => updateEvent(refId, { start_at: start.toISOString(), end_at: end.toISOString(), all_day: allDay }).then((ok) => !ok && arg.revert());
      if (allDay) commit();
      else checkMove("event", refId, arg.event.title, start, end, arg.revert, commit);
    } else if (kind === "task") {
      if (arg.event.allDay) {
        arg.revert();
        return;
      }
      checkMove("task", refId, arg.event.title, start, end, arg.revert, () => updateTask(refId, { scheduled_start: start.toISOString(), scheduled_end: end.toISOString() }).then((ok) => !ok && arg.revert()));
    } else arg.revert();
  };

  const onReceive = (arg: EventReceiveArg) => {
    const refId = (arg.event.extendedProps as { refId: string }).refId;
    const start = arg.event.start!;
    const end = arg.event.end ?? new Date(start.getTime() + 30 * 60000);
    // the persisted task block renders from data; drop the temporary event
    arg.event.remove();
    if (arg.event.allDay) {
      ui.openFindTime(refId);
      return;
    }
    checkMove("task", refId, arg.event.title, start, end, () => {}, () => updateTask(refId, { scheduled_start: start.toISOString(), scheduled_end: end.toISOString() }));
  };

  const onClick = (arg: EventClickArg) => {
    arg.jsEvent.preventDefault();
    const { kind, refId } = arg.event.extendedProps as { kind: string; refId: string };
    if (kind === "event") ui.openEvent(refId);
    else ui.openTask(refId);
  };

  const onSelect = (arg: DateSelectArg) => {
    onSelectRange(arg.start, arg.end, arg.allDay);
    arg.view.calendar.unselect();
  };

  return (
    <FullCalendar
      ref={calRef}
      plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin]}
      initialView={view}
      headerToolbar={false}
      timeZone="local"
      firstDay={prefs?.week_starts_on ?? 1}
      height={view === "listWeek" || view === "dayGridMonth" ? "auto" : 720}
      expandRows
      nowIndicator
      editable
      droppable
      selectable
      selectMirror
      dayMaxEvents={3}
      eventDisplay="block"
      slotMinTime="06:00:00"
      slotMaxTime="24:00:00"
      scrollTime={prefs?.work_start ? `${prefs.work_start}:00` : "08:00:00"}
      businessHours={prefs ? { daysOfWeek: [1, 2, 3, 4, 5], startTime: prefs.work_start, endTime: prefs.work_end } : undefined}
      allDayText="All day"
      noEventsContent="Nothing scheduled this week."
      eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
      events={items}
      eventClick={onClick}
      eventDrop={onDrop}
      eventResize={onDrop}
      eventReceive={onReceive}
      select={onSelect}
      datesSet={(arg: DatesSetArg) => onTitle(arg.view.title)}
      eventDidMount={(info) => {
        info.el.setAttribute("tabindex", "0");
        info.el.setAttribute("role", "button");
        info.el.setAttribute("aria-label", `${info.event.title}${info.event.start ? `, ${info.event.allDay ? "all day" : info.event.start.toLocaleString()}` : ""}`);
        info.el.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            info.el.click();
          }
        });
      }}
    />
  );
});
