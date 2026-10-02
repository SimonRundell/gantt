# Teacher guide

Notes for running the Gantt Chart Planner with a class.

## Before the first lesson

- Open the app on a student machine and check you can create a chart, make an edit, and reopen it from the link.
- Remind students that **the edit link is the key to their chart**. Anyone with it can change it. They should save it (a OneNote page works well) as well as relying on the recent list, which lives in one browser on one computer.
- Tell students not to put names, contact details or anything personal in a chart.

## Setting the college holiday calendar

Each chart has its own working calendar: Monday to Friday by default, plus any holidays and closures you add. Tasks skip these days, so a plan that runs over half term or Christmas stretches properly. A task that starts on a day that has become a holiday moves forward to the next working day, and you can undo that in one step.

1. Open a chart and choose **Calendar** in the toolbar.
2. Tick the days of the week that count as working days, and choose which day the week starts on.
3. Under **Holidays and closures**, pick a **From** date (and a **To** date for a run of days such as half term), then choose **Add**. Leave **To** empty for a single day.
4. For England bank holidays choose **Add 2026 bank holidays** or **Add 2027 bank holidays**. Only those two years are built in.
5. Each holiday or run of days appears in a list with a **Remove** button. Choose **Save calendar** when you are finished, or **Cancel** to leave the chart as it was.

Calendar settings belong to the chart, so to give every student the same holidays, set them up in a template chart and share that (see below).

## Sharing a template with a class

1. Build the starting plan the way you want students to see it (tasks, groups, milestones, dependencies, and your holidays set in the **Calendar** dialog).
2. **Download** the `.json` file.
3. Put it on your VLE or shared drive. Students go to the home page, choose **Upload a .json file**, and then pick **open as a new chart**. Each student gets their own copy with their own edit link, so nobody overwrites anyone else.

If you would rather everyone work on one shared chart (a group project), create it once and share its **edit link** with the group. Two people saving at the same moment get a conflict message and nothing is lost, but it works best when one person edits at a time.

To let students look at your example without changing it, give them the **view link** instead.

## Classroom activities for planning an Employer Set Project

The **Employer Set Project (12 weeks)** template gives a realistic skeleton: research, design, build, test and submission phases. Some ways to use it:

1. **Break it down (30 minutes).** Start from a blank chart. Give students the employer brief and ask them to list the deliverables as tasks, then group them into phases. Compare with the template afterwards and discuss what they missed.
2. **Estimate, then check (20 minutes).** Students put a duration on every task before looking at anyone else's. Pairs swap and challenge each other's numbers. A task longer than about two weeks usually needs splitting.
3. **Find the dependencies (30 minutes).** Students link tasks by dragging between bars. Ask what has to finish before the next thing can start, and when two things can run at once. Try each of the four types at least once and explain why it fits.
4. **Try to break it.** Ask students to create a circular dependency on purpose and read the message. Then ask what it means in real life (two tasks each waiting for the other).
5. **Critical path (15 minutes).** Switch on **Critical path** and ask which tasks cannot slip without moving the deadline. Students then move a non-critical task and a critical one and describe the difference.
6. **Slip and recover.** Make one task take twice as long and watch the knock-on effects. Students decide what they would change (cut scope, add hours, reorder) and record why.
7. **Progress check-ins.** Each week students update the percent complete and export a PDF. Keeping the exports gives them evidence of planning and review for their portfolio.
8. **Present the plan.** Students use **Export** (A3 landscape works well for display) or the print view to present their plan to a partner and justify the milestones.

## Housekeeping

- The server deletes charts nobody has touched for 365 days (see the cleanup script in the README). Tell students to download a `.json` copy of anything they need to keep for assessment.
- Students can use the keyboard throughout. Press `?` in the editor for the shortcut list.
