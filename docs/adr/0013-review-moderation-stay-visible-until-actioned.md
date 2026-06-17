# Review moderation: reported reviews stay visible until actioned

When a User reports a Review for inappropriate content, the Review remains publicly visible until the Admin explicitly dismisses the report or deletes the Review. There is no automatic hiding on first report.

## Considered Options

- **Auto-hide on first report** *(rejected)*: Any single report immediately hides the Review from public view. Simple to implement, but trivially abusable — a competitor or bad actor can suppress any positive review with a single click. Restoring a wrongly-hidden review also requires admin action, making false reports a denial-of-service vector against legitimate reviewers.
- **Auto-hide after N reports** *(rejected)*: Raises the bar but still gameable at scale, and adds complexity around choosing a threshold and resetting the count after a dismissal.
- **Stay visible until actioned** *(chosen)*: Reports are queued for the Admin (identified by `ADMIN_USER_ID`). The Review stays live until the Admin dismisses the report or deletes the Review. Means inappropriate content can linger, but the app is not at a scale where automated moderation is necessary, and the approach cannot be weaponised by a single bad actor.
