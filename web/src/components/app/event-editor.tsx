"use client";
import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { useData } from "@/providers/data-provider";
import { useUI } from "@/providers/ui-provider";
import { addDaysKey, formatTimeRange, localDate, localHHMM, localKey, localTimeZone } from "@/lib/time";
import { busyForRange, findConflicts, type Busy } from "@/lib/planner";

const schema = z
  .object({
    title: z.string().trim().min(1, "Give the event a title").max(200),
    date: z.string().min(1, "Pick a date"),
    end_date: z.string().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
    all_day: z.boolean(),
    location: z.string().max(300).optional(),
    description: z.string().max(4000).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.all_day) {
      if (v.end_date && v.end_date < v.date) ctx.addIssue({ code: "custom", path: ["end_date"], message: "End date is before start" });
      return;
    }
    if (!v.start) ctx.addIssue({ code: "custom", path: ["start"], message: "Pick a start time" });
    if (!v.end) ctx.addIssue({ code: "custom", path: ["end"], message: "Pick an end time" });
    if (v.start && v.end && v.end <= v.start) ctx.addIssue({ code: "custom", path: ["end"], message: "End must be after start" });
  });

type FormValues = z.infer<typeof schema>;

export function describeConflicts(conflicts: Busy[]) {
  return conflicts.map((c) => `“${c.label}” (${formatTimeRange(new Date(c.start).toISOString(), new Date(c.end).toISOString())})`).join(", ");
}

export function EventEditor() {
  const ui = useUI();
  const { events, tasks, createEvent, updateEvent, deleteEvent } = useData();
  const existing = ui.event.id ? events.find((e) => e.id === ui.event.id) ?? null : null;
  const draft = ui.event.draft;
  const [conflicts, setConflicts] = useState<Busy[] | null>(null);
  const [saving, setSaving] = useState(false);

  const defaults = useMemo<FormValues>(() => {
    const src = existing ?? draft ?? {};
    const now = new Date();
    const start = src.start_at ? new Date(src.start_at) : new Date(Math.ceil(now.getTime() / 1800000) * 1800000);
    const end = src.end_at ? new Date(src.end_at) : new Date(start.getTime() + 3600000);
    const allDay = src.all_day ?? false;
    return {
      title: src.title ?? "",
      date: localKey(start),
      end_date: allDay ? addDaysKey(localKey(end), -1) : "",
      start: localHHMM(start),
      end: localHHMM(end),
      all_day: allDay,
      location: src.location ?? "",
      description: src.description ?? "",
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.event.id, ui.event.draft, ui.event.open]);

  const { register, handleSubmit, reset, watch, setValue, formState } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: defaults });
  const allDay = watch("all_day");

  useEffect(() => {
    if (ui.event.open) {
      reset(defaults);
      setConflicts(null);
    }
  }, [ui.event.open, defaults, reset]);

  const toRange = (v: FormValues) => {
    if (v.all_day) {
      const endKey = v.end_date && v.end_date >= v.date ? v.end_date : v.date;
      return { start_at: localDate(v.date).toISOString(), end_at: localDate(addDaysKey(endKey, 1)).toISOString() };
    }
    return { start_at: localDate(v.date, v.start!).toISOString(), end_at: localDate(v.date, v.end!).toISOString() };
  };

  const save = async (v: FormValues, force: boolean) => {
    const range = toRange(v);
    if (!v.all_day && !force) {
      const s = Date.parse(range.start_at);
      const e = Date.parse(range.end_at);
      const others = events.filter((x) => x.id !== existing?.id);
      const clash = findConflicts(s, e, busyForRange(s, e, others, tasks));
      if (clash.length) {
        setConflicts(clash);
        return;
      }
    }
    setSaving(true);
    const payload = { title: v.title.trim(), ...range, all_day: v.all_day, location: v.location?.trim() || null, description: v.description?.trim() || null, timezone: localTimeZone() };
    const ok = existing ? await updateEvent(existing.id, payload) : !!(await createEvent(payload));
    setSaving(false);
    if (ok) ui.closeEvent();
  };

  const onSubmit = handleSubmit((v) => save(v, false));

  return (
    <Dialog
      open={ui.event.open}
      onClose={ui.closeEvent}
      title={existing ? "Edit event" : "New event"}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <div>
            {existing && (
              <Button
                variant="ghost"
                size="sm"
                className="text-danger hover:bg-danger/10 hover:text-danger"
                onClick={() => {
                  deleteEvent(existing.id);
                  ui.closeEvent();
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={ui.closeEvent}>
              Cancel
            </Button>
            {conflicts ? (
              <Button variant="primary" loading={saving} onClick={handleSubmit((v) => save(v, true))}>
                Save anyway
              </Button>
            ) : (
              <Button variant="primary" onClick={onSubmit} loading={saving} data-testid="save-event">
                {existing ? "Save" : "Create event"}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate onChange={() => conflicts && setConflicts(null)}>
        <Field label="Title" error={formState.errors.title?.message}>
          {(p) => <Input {...p} data-autofocus {...register("title")} placeholder="Event name" autoComplete="off" className="h-10 text-[15px]" />}
        </Field>
        <div className="flex items-center justify-between rounded-lg border border-line bg-surface px-3 py-2">
          <label htmlFor="event-allday" className="text-sm text-muted">
            All day
          </label>
          <Toggle id="event-allday" label="All day" checked={allDay} onChange={(v) => setValue("all_day", v)} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Date" error={formState.errors.date?.message} className={allDay ? "col-span-1" : "col-span-2 sm:col-span-1"}>
            {(p) => <Input {...p} type="date" {...register("date")} />}
          </Field>
          {allDay ? (
            <Field label="Until (optional)" error={formState.errors.end_date?.message}>
              {(p) => <Input {...p} type="date" {...register("end_date")} />}
            </Field>
          ) : (
            <>
              <Field label="Starts" error={formState.errors.start?.message}>
                {(p) => <Input {...p} type="time" {...register("start")} />}
              </Field>
              <Field label="Ends" error={formState.errors.end?.message}>
                {(p) => <Input {...p} type="time" {...register("end")} />}
              </Field>
            </>
          )}
        </div>
        {conflicts && (
          <div role="alert" className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="font-medium text-fg">This overlaps something already on your calendar</p>
              <p className="mt-0.5 text-muted">Conflicts with {describeConflicts(conflicts)}. Adjust the time, or save anyway to keep both.</p>
            </div>
          </div>
        )}
        <Field label="Location">
          {(p) => <Input {...p} {...register("location")} placeholder="Optional" />}
        </Field>
        <Field label="Notes">
          {(p) => <Textarea {...p} {...register("description")} rows={3} placeholder="Optional" />}
        </Field>
      </form>
    </Dialog>
  );
}
