# Feature implementation

Not built yet. The [README](../README.md) describes the product Media and Design can talk about. This list is the work still to do in the app.

| Feature | Status |
| --- | --- |
| [Transfer primary admin](#transfer-primary-admin) | Not built |
| [Partner competitions by year](#partner-competitions-by-year) | Not built |
| [Payments](#payments) | Not built |

## Transfer primary admin

Team and competition primary admins can hand primary ownership to another user.

1. The current primary admin invites that person as a secondary admin.
2. The invitee approves, the same way other secondary admins do.
3. The primary admin then transfers primary ownership to that secondary admin.
4. The previous primary admin becomes a secondary admin. One primary remains.
5. The roster, profile, applications, and listing stay on the same team or competition.

Today a primary admin can invite and remove secondary admins only. Removing the primary admin is blocked. Reopening a claim is limited to circuit ops and clears every admin. This feature replaces that path for a normal leadership change.

## Partner competitions by year

A competition that is a partner one year might not be a partner the next. This is for competitions only. Teams stay on the platform. Listings today persist until someone removes them, so a host that sits out a season would still appear.

Find a way to carry a partner competition for the year it belongs to, and leave it off the next season when the partnership does not continue. Applications, judging, and results for the year it ran should stay intact.

## Payments

The site does not take money yet. The home, team, apply, and Payments pages explain the manual process. The PayPal link is a generic placeholder, so teams must confirm the real recipient before paying. The memo is `{Team}'s OneLegends Payment`.

A free path is a Zelle or PayPal link, with circuit ops still marking dues paid by unblocking the team. A minimal-cost path is a bank debit or card link that can confirm the payment in the app later. Each competition would keep its own link. Circuit dues stay separate from a host’s application fee.
