# Review moderation flow

How a Review is written, liked and reported, and how the Admin actions a Review Report. Covers `reviews`, `review_likes` and `review_reports`. Decision record: ADR-0013 (a reported Review stays visible until the Admin actions it). Terms (Review, Review Report, Admin) are in `CONTEXT.md`.

Last verified: 2026-11-25, against 524861d

Key code: `src/lib/reviews.ts`, `app/api/recipes/[id]/reviews/route.ts`, `app/api/reviews/[reviewId]/` (`route.ts`, `like/`, `report/`), `app/api/admin/reports/` (`route.ts`, `[reportId]/route.ts`, `[reportId]/review/route.ts`), `app/api/cron/review-reports/daily/route.ts`, `vercel.json` (cron `0 7 * * *`). The admin email on a new report is described in `admin-signals.md`.

```mermaid
flowchart TD
    Reader(["Signed-in User on a Recipe"]) --> What{"What do they do?"}

    What -->|"Write a Review"| Create["POST /api/recipes/id/reviews<br/>rating 1 to 5, body up to 2000 chars"]
    Create --> CanReview{"Recipe is public and not deleted,<br/>and the User is not its author?"}
    CanReview -->|"No"| R403["403 with the reason"]
    CanReview -->|"Yes"| Insert["Insert reviews row<br/>(one per User per Recipe: unique user_id, recipe_id)"]
    Insert --> Dup{"Already reviewed this Recipe?"}
    Dup -->|"Yes: unique violation"| R403
    Dup -->|"No"| R201["201 Review shown publicly at once"]

    What -->|"Edit own Review"| Edit["PUT /api/reviews/reviewId"]
    Edit --> EditOwn{"Review belongs to the User?"}
    EditOwn -->|"No"| R404["404 Not found"]
    EditOwn -->|"Yes"| Upd["Update rating or body, set date_updated"]

    What -->|"Delete own Review"| OwnDel["DELETE /api/reviews/reviewId"]
    OwnDel --> OwnerCheck{"Exists, and owned by the User?"}
    OwnerCheck -->|"Not found"| R404
    OwnerCheck -->|"Someone else's"| R403b["403 Forbidden"]
    OwnerCheck -->|"Yes"| Gone

    What -->|"Like or unlike"| Like["POST /api/reviews/reviewId/like"]
    Like --> LikeOk{"Review exists and is not the User's own?"}
    LikeOk -->|"No"| R403c["403 with the reason"]
    LikeOk -->|"Yes"| Toggle{"review_likes row exists for User and Review?"}
    Toggle -->|"Yes"| Unlike["Delete the like: liked false"]
    Toggle -->|"No"| AddLike["Insert the like: liked true"]

    What -->|"Report a Review"| Report["POST /api/reviews/reviewId/report<br/>reason, optional comment up to 500 chars"]
    Report --> Reason{"Reason is spam, offensive_language,<br/>harassment or off_topic?"}
    Reason -->|"No"| R400["400 Invalid reason"]
    Reason -->|"Yes"| RInsert["Insert review_reports row<br/>(one per User per Review: unique user_id, review_id)"]
    RInsert --> RDup{"Already reported, or Review missing?"}
    RDup -->|"Yes: constraint error"| R409["409 with the message"]
    RDup -->|"No"| R201b["201 reported true"]
    R201b --> Evt["review-report admin event<br/>(after the response, see admin-signals.md)"]
    R201b --> StillVisible["The Review stays visible and is not changed<br/>(ADR-0013: no auto-hide)"]

    Evt --> Queue
    StillVisible --> Queue["Admin queue: GET /api/admin/reports<br/>all open reports, newest first<br/>(Admin only, else 403)"]
    Daily(["Cron 07:00 daily"]) --> Since["Reports from the last 24 hours"]
    Since --> Any{"Any reports?"}
    Any -->|"No"| NoMail["No email"]
    Any -->|"Yes"| Mail["Summary email to the Admin<br/>with a link to /admin/reports"]
    Mail --> Queue

    Queue --> Decide{"Admin decision"}
    Decide -->|"Dismiss"| Dismiss["DELETE /api/admin/reports/reportId<br/>deletes that review_reports row only"]
    Dismiss --> Stays["Review stays, its other reports stay,<br/>likes untouched"]
    Decide -->|"Delete the Review"| AdminDel["DELETE /api/admin/reports/reportId/review<br/>deleteReview(report.reviewId)"]
    AdminDel --> Gone["Review row hard-deleted"]
    Gone --> Cascade["FK cascade removes its review_likes<br/>and every review_reports row for it"]
```

## Notes

- Nothing here is a soft delete: reviews, likes and reports are removed with `DELETE`, so the tables have no `date_deleted`.
- A Recipe's author cannot delete a Review on their Recipe; they can only report it (`CONTEXT.md`, Review Report).
- `user_id` on all three tables is `ON DELETE SET NULL`, so a Review, like or report outlives its author's account (the author then shows as no username). Recipes are soft-deleted, but a hard delete of a Recipe row cascades to its Reviews, and from them to likes and reports.
- The report route does not check that the Review exists before inserting; a missing Review surfaces as the same 409 as a duplicate report.
