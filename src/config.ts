const config = (
  await import("../config.json", {
    with: { type: "json" },
  })
).default;

export default {
  ...config,
  tags: {
    unanswered: process.env.TAG_UNANSWERED,
    unsolved: process.env.TAG_UNSOLVED,
    solved: process.env.TAG_SOLVED,
    review: process.env.TAG_REVIEW,
  },
};
