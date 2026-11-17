# neon-limity

Neon HUD above the Claude Code prompt: context, cache, 5h and 7-day limits as ring gauges, model and effort badges, session cost, and a pixel-art Claude mascot in a Hawaiian shirt on a synthwave beach.

- The sun sinks as the 5h limit drains; night falls when it runs out.
- Clouds and rain follow the context fill.
- The mascot walks while Claude works, and uses a laptop, a terminal or binoculars depending on the tool. A mini Claude joins when a subagent runs.
- While waiting it takes its shades off and blinks; after 15 idle minutes it naps on a hammock.
- Mission banner with a jingle after a long turn, a cash pickup showing each answer's cost, a police boat at a high wanted level, and a WASTED screen when a limit runs out.
- `/limity` hides or shows the HUD. The "💬" button under the scene gives a random tip.

Labels in the HUD are in Polish.

## Install

At the prompt of a terminal session:

```
/plugin install neon-limity --marketplace Aloister/neon-limity
```

From a shell:

```
claude plugin install neon-limity --marketplace Aloister/neon-limity
```

In the desktop app, where `/plugin` does not run: click + next to the prompt box, then Plugins, Add marketplace with `Aloister/neon-limity`, then Add plugin.
