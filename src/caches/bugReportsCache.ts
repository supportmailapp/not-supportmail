import NodeCache from "node-cache";

let bugReportCache = new NodeCache({
  stdTTL: 900,
  checkperiod: 30,
  errorOnMissing: false,
});

function getCurrentProcess(userid: string): string {
  return bugReportCache.get(userid) || null;
}

function setProcess(userid: string, threadUrl: any) {
  bugReportCache.set(userid, threadUrl);
}

function deleteProcess(userid: string) {
  bugReportCache.del(userid);
}

export default { getCurrentProcess, setProcess, deleteProcess };
