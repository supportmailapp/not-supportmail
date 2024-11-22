const config = (
  await import("../config.json", {
    with: { type: "json" },
  })
).default;

export default config;
