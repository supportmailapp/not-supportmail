# discord.js App Template

A template for discord.js apps.

---

## Used dependencies

- [`discord.js`](https://discord.js.org/)
- [`djsCommandHelper`](https://github.com/The-LukeZ/djsCommandHelper)

## Use

To use this template, fork or clone repository and since it's a template, you can just start building your application.

## Structures

### Components

Components handle message component interactions, as well as modal interactions.

In our example structure, we have a sub-folder in our `src` folder named `components`. All `*.js` files inside are treated as component files. I usually prefer to have a sub-folder for utility files in there as well.

Component files **have** to `default export` an object with the properties `prefix` and `run`.

#### Component prefix

Component prefixes are strings. They are built like a URL with query parameters.
The parameters don't have the usual `key=value` structure. They're also built like a path.

**Fun fact:** Component prefixes match the following regex:

```regex
^[^/]+(?:\/[^/]+)*(?:\?(?:[^/]+(?:\/[^/]+)*))?
```

##### Examples

- Simple component: `help`
- Sub component (e.g. for a specific help-page): `help/commands`
- Component with param (e.g. for a pagination system you have to pass the current page): `some/component/page?2`
- Everything: `foo/bar?fizz/buzz/123`

#### The `run` property

This should be an async function that takes one parameter as the Interaction.

#### Example

```js
default export {
  prefix: "help",

  async run(ctx) {
    await ctx.reply("beep");
  },
}
```

### Commands

See the article of the [`djsCommandHelper`](https://github.com/The-LukeZ/djsCommandHelper?tab=readme-ov-file#the-command-file) for more information on the command file itself.

Basically, all `*.js` files inside are treated as command files. I usually prefer to have a sub-folder `utils` for utility files in there as well.

> [!TIP]
> If you have complex subcommands/subcommand groups, put them inside the utility folder and import them in the base command file.

### Events

Events are dynamically loaded. In this example we have an `events` sub-folder in our `src` directory.

Since events can have multiple listeners and sometimes one event file is a bit too complicated, we make another folder for every event there is inside the `events` folder, which houses files that `export default` a function that acts as the event listener.

> [!NOTE]
> An overview of supported events can be found here: [Click](https://discord.js.org/docs/packages/discord.js/14.16.3/ClientEvents:Interface)

## Contribute

You are free to contribute to this template. Just fork the repository and create a pull request.
