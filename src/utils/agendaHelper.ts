import dayjs from "dayjs";
// @ts-ignore - We dont use AgendaNotInitializedError here but we need to import it
import { type AgendaNotInitializedError, getAgenda } from "../scheduler/agenda";
import type { JobsResult } from "agenda";

/**
 * Schedules a reminder job to check in with the user 24 hours after they create a support thread.
 * @param userId The user id of the thread creator
 * @param postId The thread id of the support post
 * @throws {AgendaNotInitializedError} If the agenda scheduler has not been initialized yet
 */
export async function addPostReminderJob(userId: string, postId: string) {
  const agenda = getAgenda();
  const in24h = dayjs().add(24, "hour").toDate();
  await agenda.schedule(in24h, "postReminder", { postId, userId });
}

/**
 * Removes the scheduled reminder job for a given post and user. This should be called when a support thread is resolved or closed to prevent unnecessary reminders.
 * @param postId The thread id of the support post
 * @param userId The user id of the thread creator
 * @throws {AgendaNotInitializedError} If the agenda scheduler has not been initialized yet
 */
export async function removePostReminderJob(postId: string, userId: string) {
  const agenda = getAgenda();
  await agenda.cancel({ name: "postReminder", data: { postId, userId } });
}

export async function reschedulePostReminderJob(
  postId: string,
  userId: string,
) {
  const agenda = getAgenda();
  await agenda.cancel({ name: "postReminder", data: { postId, userId } });
  await addPostReminderJob(userId, postId);
}

/**
 * Lists the next 50 scheduled post reminder jobs.
 * @returns An array of job details including the scheduled time, postId, and userId for each reminder job.
 * @throws {AgendaNotInitializedError} If the agenda scheduler has not been initialized yet
 */
export async function listPostReminderJobs() {
  const agenda = getAgenda();
  const jobs = await agenda.queryJobs({
    name: "postReminder",
    limit: 50,
    sort: { nextRunAt: "asc" },
  });
  return (jobs as JobsResult<any>).jobs.map((job) => ({
    nextRunAt: dayjs(job.nextRunAt).unix().toString(),
    postId: job.data?.postId,
    userId: job.data?.userId,
  }));
}
