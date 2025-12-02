module.exports = {
  apps: [{
    name: "back.ofline-registration",
    script: "./dist/#src/index.js",
    watch: true,
    node_args: "--no-warnings"
  }]
}
