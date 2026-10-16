# 工地：轻量项目管理应用

Status: ready-for-agent

## Problem Statement

团队需要一个轻量、可在内网使用的项目管理应用，以清晰、美观且有趣的方式查看项目进度、任务安排和成员参与情况。现有想法强调时间轴、任务拆分、负责人和进度可视化，但需要明确边界，避免一个视觉导向的小工具演变成复杂的项目管理平台。

## Solution

从空仓库构建中文 Web 应用「工地」。应用以项目卡片为入口，项目详情由可切换周/月刻度的时间轴、任务编辑面板和扁平 SVG 工地场景组成。团队成员通过颜色和工人插画呈现；具体任务状态汇总为项目进度，并驱动中央房子的建造阶段。应用运行于一台 Node 22+ 电脑，团队通过局域网浏览器访问；不要求登录，数据保存在本机 SQLite 数据库。

视觉展示是核心验收目标，产品范围保持克制：两层任务、必要的日期与状态、简洁的附件链接、直接的拖拽操作，不加入完整项目管理套件常见的协作与权限功能。

## User Stories

1. As a team member, I want to open a中文工地项目管理应用, so that I can manage our project work in one lightweight place.
2. As a team member, I want to see all projects as visual cards, so that I can scan their dates and progress quickly.
3. As a team member, I want to create a project with a name and start/end dates, so that the team can begin planning it.
4. As a team member, I want a new project to default to a 30-day period starting today, so that project creation is quick.
5. As a team member, I want to see an empty-state project creation entry when there are no projects, so that I know how to begin.
6. As a team member, I want to create a project before creating team members, so that setup order does not block planning.
7. As a team member, I want to see project completion percentage and a matching miniature house on each project card, so that progress is understandable at a glance.
8. As a team member, I want project cards to show counts of not-started, in-progress, and completed tasks, so that I can assess project workload quickly.
9. As a team member, I want current projects prioritized on the project list, followed by other projects in creation-time order, so that active work is easy to find.
10. As a team member, I want to open a project and see its dates, timeline scale controls, team navigation, timeline, and construction site, so that planning and progress are available in one view.
11. As a team member, I want the timeline to show a short project’s complete date range, so that near-term work is visible together.
12. As a team member, I want a long project timeline to open near today, so that the current planning context is immediately visible.
13. As a team member, I want to switch between week and month scales without changing task dates, so that I can inspect work at different levels.
14. As a team member, I want week scale to show days grouped into Monday-starting weeks, so that I can plan precise dates.
15. As a team member, I want month scale to show a compact monthly overview, so that long-range work remains legible.
16. As a team member, I want the timeline to scroll horizontally when the viewport is narrow, so that date ranges remain accessible without a mobile-specific layout.
17. As a team member, I want to add a big task with a default title and a seven-day range beginning today, constrained to the project period, so that I can place a task quickly.
18. As a team member, I want a newly created big task to open in the edit panel, so that I can immediately refine it.
19. As a team member, I want to move a big task along the timeline with day snapping, so that I can adjust its schedule visually.
20. As a team member, I want to resize a big task from either edge, so that I can adjust its start or end date directly.
21. As a team member, I want a big task to remain at least one inclusive calendar day long, so that no task can have an invalid zero-day duration.
22. As a team member, I want overlapping big tasks arranged on separate rows, so that their date bars remain distinguishable.
23. As a team member, I want the month scale to be for browsing and use the week scale or date fields for day-precise changes, so that monthly display density does not make precise dragging ambiguous.
24. As a team member, I want a big task without concrete tasks to remain visible in a subdued visual style, so that planned but not-yet-broken-down work is apparent.
25. As a team member, I want to edit a project’s dates in the project header, so that the project period can be maintained directly.
26. As a team member, I want project dates to extend automatically when a big task is moved outside the current period, so that a valid task schedule is not blocked.
27. As a team member, I want project dates not to shrink automatically when tasks move inward, so that schedule edits do not unexpectedly change project boundaries.
28. As a team member, I want a project-date edit rejected with a clear explanation if it would exclude an existing big task, so that no task is silently left outside the project period.
29. As a team member, I want to select a big task by clicking its bar and edit it in a right-side panel, so that timeline selection and task editing work together.
30. As a team member, I want the panel to switch to another big task when I select it, so that I can review tasks without repeatedly closing and reopening the panel.
31. As a team member, I want to close the edit panel explicitly or with Escape, so that it does not disappear accidentally while I work.
32. As a team member, I want big-task titles, dates, and attachment text to save on field blur, so that edits persist without a separate save action.
33. As a team member, I want discrete selections such as status and assignee to save immediately, so that their effect is reflected promptly.
34. As a team member, I want to add concrete tasks under a big task with a default title, not-started status, and no assignee, so that breakdown is quick and new work is not falsely attributed.
35. As a team member, I want a newly added concrete task to affect the project denominator immediately, so that the displayed completion ratio reflects all defined work.
36. As a team member, I want concrete tasks limited to one level below big tasks, so that the tool remains simple.
37. As a team member, I want concrete tasks to stay under their original big task, so that cross-task moving and its extra scheduling behavior are avoided.
38. As a team member, I want concrete tasks ordered by creation time, so that their order is stable without a manual sorting feature.
39. As a team member, I want to set each concrete task to not started, in progress, or completed using an immediately understandable three-state control, so that the team can report its work state accurately.
40. As a team member, I want task status to be explicitly chosen rather than inferred from dates or activity, so that reported progress reflects team knowledge.
41. As a team member, I want to assign a concrete task to zero or one roster member, so that responsibility is clear while unassigned work remains valid.
42. As a team member, I want to manage team members by name and representative color, so that people can be identified in the construction scene.
43. As a team member, I want to edit a member’s name or color and see that change reflected wherever they are assigned, so that roster information stays consistent.
44. As a team member, I want to filter the construction scene’s emphasis by clicking a worker, so that I can see which big tasks that person participates in.
45. As a team member, I want a worker to count as participating in a big task whenever they own at least one concrete task under it, regardless of status, so that completed contribution remains visible.
46. As a team member, I want clicking the selected worker again to clear the highlight, so that I can restore the full project view.
47. As a team member, I want the selected worker’s participating big tasks highlighted and other tasks dimmed, so that the relationship is visually clear.
48. As a team member, I want each assigned worker shown in front of the house with their own completed/total task ratio, so that individual contribution is visible.
49. As a team member, I want task counts shown for not-started, in-progress, and completed states, so that the site communicates work status alongside the house.
50. As a team member, I want the house completion percentage calculated only from completed concrete tasks divided by all concrete tasks, so that the visual has one predictable source of truth.
51. As a team member, I want in-progress tasks included in the denominator but not the completed numerator, so that started work is not mistaken for finished work.
52. As a team member, I want empty big tasks excluded from the progress denominator, so that unbroken-down plans do not distort completion.
53. As a team member, I want an empty project or a project with no completed concrete tasks to show 0% and an empty site, so that progress is not invented.
54. As a team member, I want partial progress rounded to an integer and mapped to the defined house stages, so that small state changes have a readable visual representation.
55. As a team member, I want all tasks completed to show a 100% house with illuminated windows, so that completion has a distinct celebratory state.
56. As a team member, I want house stage transitions to animate briefly unless the operating system requests reduced motion, so that the scene feels dynamic without disregarding accessibility settings.
57. As a team member, I want house and worker illustrations to be layered flat SVG artwork, so that the visual identity remains cohesive and lightweight.
58. As a team member, I want member colors used on workers and big-task colors used on timeline bars, so that visual encodings remain consistent and unambiguous.
59. As a team member, I want to add multiple optional attachments to a concrete task, so that relevant file or reference locations can be recorded.
60. As a team member, I want an attachment with both name and address blank to be discarded, so that empty entries do not clutter the task.
61. As a team member, I want an attachment with a name but no address displayed as plain text, so that useful notes do not require a link.
62. As a team member, I want HTTP(S) attachment addresses to open in a new tab, so that I can visit external references without losing my place.
63. As a team member, I want non-HTTP(S) attachment paths copied to the clipboard when clicked, so that local or internal paths can be reused safely.
64. As a team member, I want attachment links not to be fetched, previewed, or executed by the application, so that links remain lightweight and their protocols are constrained.
65. As a team member, I want to delete projects, big tasks, concrete tasks, members, and attachments after an impact-specific confirmation, so that destructive actions are deliberate.
66. As a team member, I want deleting a project to permanently delete all its tasks and attachments, so that project removal is complete and unambiguous.
67. As a team member, I want deleting a big task to permanently delete its concrete tasks and attachments, so that orphaned work is not retained.
68. As a team member, I want deleting a member to leave their tasks intact but unassigned, so that work survives roster changes.
69. As a team member, I want any saved change to become visible to other browsers within a few seconds via lightweight polling, so that the team sees shared updates without manually refreshing or requiring a real-time messaging system.
70. As a team member, I want the latest write to win when concurrent edits change the same record, so that conflict behavior is simple and predictable.
71. As a team member, I want failed saves to preserve my local edit and show an actionable failure state, so that transient service errors do not silently erase work.
72. As a team member, I want to retry a failed save, so that I can persist the change after connectivity returns.
73. As a team member, I want a temporary demo mode that uses in-memory example data, so that I can inspect and interact with the visuals without contaminating real project data.
74. As a team member, I want demo data to disappear when leaving demo mode, so that it cannot be confused with persisted work.
75. As a team member, I want the application served from one Node 22+ machine with a browser-accessible LAN address, so that teammates can use the shared local database.
76. As a team member, I want the app to use a same-origin API during development, so that browser requests do not require a separate cross-origin setup.
77. As a team member, I want project, member, task, and attachment data persisted in a local SQLite database, so that work survives application restarts.
78. As a team member, I want all text in Chinese, keyboard focus states, readable contrast, SVG icons, and no emoji, so that the app is polished and usable.
79. As a team member, I want the interface to prioritize a desktop-wide composition and keep the timeline horizontally usable in narrow windows, so that the first version can focus on its primary planning environment.
80. As a team member, I want to use the app without accounts or roles on a trusted LAN, so that the first version avoids authentication and permission-system complexity.

## Implementation Decisions

- Build a single-context application from the currently empty application repository using React, TypeScript, and Vite for the client, plus a Node 22+ HTTP API using built-in `node:sqlite` for persistence. Keep API requests same-origin in development through the Vite proxy.
- Persist data in a local SQLite database under the application data directory; do not commit the database file. The server listens on all network interfaces and prints an available LAN address.
- Use a shared team roster with member name and representative color. No accounts, authentication, roles, or permission checks are part of this version. Assume a trusted team LAN. Concurrent edits use last-write-wins behavior.
- Model Project -> BigTask -> ConcreteTask -> Attachment. A BigTask belongs to one Project and has title, inclusive start/end dates, and a distinguishing color. A ConcreteTask belongs to one BigTask and has title, optional single Member assignee, one of three statuses, and stable creation order. Attachments belong only to ConcreteTask and contain optional name and address. Deleting a Member sets related task assignees to null; deleting a BigTask or Project cascades through descendants.
- Provide resource-oriented REST endpoints for members, projects, big tasks, concrete tasks, and attachments. Compute progress and status summaries on read rather than persisting derived values.
- Treat dates as inclusive calendar dates: a task starting and ending on the same day is one day. Week scale is day-granular and starts weeks on Monday; month scale is a compact overview. Month scale is browse-only for dragging; use week scale or date controls for precise dates. Timeline drag operations snap to days, support moving and resizing task bars, and preserve a one-day minimum.
- Show all dates for short projects and open long projects near today. Overlapping BigTasks occupy separate rows. BigTasks without ConcreteTasks remain visible in a subdued style. Dragging a task outside the project range automatically extends the Project; moving tasks inward never automatically shrinks it. Manual Project date edits that would exclude a BigTask are rejected and explained.
- Create BigTasks with a default title and seven-day range beginning today, clamped to the project period, and immediately select them. Create ConcreteTasks with a default title, not-started status, and no assignee. New ConcreteTasks immediately count in progress calculations. ConcreteTasks cannot be nested further, moved between BigTasks, or manually reordered; they remain in creation order.
- Clicking a BigTask bar selects it and opens/updates a right-side edit panel. The panel can be closed by an explicit control or Escape. Text and date fields save on blur; discrete selections save immediately. The timeline is responsible for selection and drag interaction; the panel edits task details.
- Use three-state status controls. Progress is completed ConcreteTasks divided by all ConcreteTasks across the Project. In-progress tasks count only in the denominator. Empty BigTasks do not add to the denominator. Zero tasks or zero completed tasks maps to 0% and an empty site; partial percentage is rounded to an integer and capped to 1-99 for stage selection; all completed maps to 100% and illuminated windows. The defined percentage bands drive the house construction stage. Member-specific ratios use each member’s completed/assigned ConcreteTasks. A member participates in a BigTask if at least one ConcreteTask under it is assigned to them, regardless of status.
- Render a central layered flat SVG house and worker figures. Animate house transitions for approximately 300-400ms unless reduced motion is requested. Use member colors only for workers and BigTask colors only for timeline bars. Display three status counts beside the site. Clicking a worker highlights their participating BigTasks and dims the others; clicking again clears the filter. The house itself is not clickable.
- Provide optional attachment name/address fields. Discard an attachment when both are blank. Name-only attachments are plain text. HTTP(S) addresses open in a new tab; other paths are copied to the clipboard. Do not upload files, fetch or preview remote addresses, or execute non-HTTP(S) protocols.
- Provide explicit confirmation for deletion, describing cascade effects for Project and BigTask deletion and unassignment effects for Member deletion. Deletion is permanent and not undoable.
- Save changes immediately to the database. Poll shared data every few seconds so other open browsers observe updates without WebSockets or SSE. On save failure, preserve the pending client value, show a visible failure and retry affordance, and do not silently discard it.
- Offer an optional demo mode backed only by transient in-memory sample data; do not write demo entities to the real database.
- Use a desktop-first layout, with horizontal timeline scrolling at narrow widths rather than a separate mobile design. Use a paper-like background, ink-colored text, safety-orange accent, Noto Sans SC, minimum 4.5:1 body-text contrast, visible keyboard focus, SVG icons, and no emoji. All interface copy is Chinese.
- Do not add task dependencies, comments, notifications, role permissions, time tracking, file uploads, custom fields, a mobile-specific design, live cursors, or cloud deployment.

## Testing Decisions

- Prefer tests of user-visible behavior over implementation details. The highest-value and primary test seam is a browser end-to-end flow against the complete client, API, and SQLite-backed application; the repository has no existing test infrastructure or prior test patterns.
- Exercise project creation and defaults; member creation/editing; BigTask creation, selection, drag-move, resize, overlap layout, and Project date constraints; ConcreteTask creation, ordering, assignment, status changes, and deletion; attachment save/open/copy behavior; and cascade/unassignment deletion effects.
- Verify computed progress and house stages at zero, each stage boundary, partial completion, and full completion; verify per-member ratios and status counts. Verify reduced-motion behavior and accessible focus/contrast expectations where browser automation permits.
- Verify worker selection and clearing, highlighting/dimming behavior, week/month scale switching without date mutation, polling visibility in a second browser context, save failure and retry behavior, and demo data isolation.
- Verify narrow-window horizontal timeline scrolling, project list ordering and summaries, empty states, and all user-facing text being Chinese.
- Unit tests for pure date/progress derivation may supplement the end-to-end seam if they are inexpensive, but tests must not assert internal component structure, SQL statements, or file layout.
- No existing application modules or comparable tests are present; test infrastructure is to be established with the feature.

## Out of Scope

- Task dependencies, comments, notifications, roles, access control, accounts, or authentication.
- Work-hour tracking, custom task fields, file uploads, or file previews.
- A mobile-specific layout, live cursors, WebSocket/SSE real-time collaboration, or cloud deployment.
- Undo/restore after deletion, soft deletion, cross-BigTask ConcreteTask movement, manual ConcreteTask ordering, or manual house-stage overrides.
- Automatic task status inference, automatic Project-period shrinking, or day-precise dragging in month scale.
- Persistent or database-backed demo records.

## Further Notes

- Product decisions were confirmed through three rounds of design review, including lightweight polling, trusted-LAN access, inclusive dates, schedule constraints, explicit task status, interaction details, visual progress semantics, failure handling, and demo isolation.
- Project-date default is today through 30 days later. BigTask default is today through seven days later, clamped to Project dates; actual duration must remain at least one inclusive day.
- House thresholds are 1-24% foundation, 25-49% frame, 50-74% walls and roof, 75-99% doors/windows and finishing, and 100% complete with lit windows. A rounded partial progress result is restricted to 1-99 before stage mapping.
- The initial requested implementation checklist should be covered by end-to-end verification: app startup and persistence, resource CRUD and validation, list/team/project UI, timeline interactions, house/worker visuals, and the complete browser workflow.
