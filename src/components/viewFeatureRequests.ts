const PREFIX = "viewFeatureRequests";

function run(ctx) {
  // parse custom ID with params
  const { action, firstParam: page } = parseCustomId(ctx.customId);
}

export default {
  prefix: PREFIX,
  run,
}
