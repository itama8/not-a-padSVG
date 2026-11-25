# Working on not-a-padSVG

The project develops reusable SVG UI through small experiments. The notepad and
X-Ray are the showcase. See [the README](README.md) for the current layout and
working example.

- Use a small case in `site/lab/` to explore an interaction or visual treatment.
  When the lab and showcase use the same piece, have them import its source
  from `site/ui/` so improvements carry forward.
- Keep SVG artwork swappable. Keep activation, focus, and accessible names on
  semantic controls, and keep page-specific layout and orchestration in the host.
- The folder structure, metadata, declarations, and schemas are experimental.
  Agents and contributors can propose changes and optimizations. Describe the
  case that motivates the change, name the callers or assets it affects, and
  show how the new shape works in an actual lab or showcase.
