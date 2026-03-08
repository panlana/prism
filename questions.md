# Open Questions

These came out of phase 1 document review. They should be answered, but they do not block initial platform planning.

## Scope and release ordering

1. Is the intended first production release the annual policy review product only, or must telephony and AI Phone CSR ship in the same release?
- this is an AI (only) tool. There's no fallback to humans.

2. Which product surfaces are mandatory for v1:
   - admin portal
   - agency portal
   - insured portal
   - telephony
   - AMS integrations

- All. we're laying the framework for the entire applciation

3. Which policy types must be fully supported first: personal auto, home, umbrella, inland marine, or a broader list?
- Focus on the structure for policies and the respective states and types. We'll start with Home and Auto, but that shouldn't change the design decisions

4. Which carriers and states should be loaded first for the initial launch cohort?
- again, don't over think it, but we'll start with Nationwide, Virginia, Home and Auto

## External integrations

5. Which agency management systems need first-class integration first?
- Applied Epic, if we can get api access

6. Which phone systems need first-class integration first?
-none

7. Which email provider should be the initial transactional email provider?
- we'll use Resend

8. Should SMS be included in v1 for reset codes and notifications, and if yes which provider is preferred?
- Put the hooks in for it, yes.

9. Where should uploaded PDFs and generated artifacts live in production: Supabase Storage, S3, or another system?
- We'll use Supabase storage

## Identity and security

10. Should PRISM staff, agency users, and insureds share one auth system or be isolated into separate auth domains?
- single

11. For "SSO via Outlook or Gmail", is the requirement true SSO for agency users only, or also for insureds?
- just agency users. "customers" will get an invitation link or a "magic" link via their email address. Since a customers can have multiple policies, they'll still need a form of authentication, but it will be via link

12. Is MFA required for any of the three user classes at launch?
- not right now

13. Are there compliance targets beyond standard SaaS controls, such as SOC 2, HIPAA-adjacent restrictions, or state-specific insurance data rules?
- not yet, but where possible, do things that would easily fit in those schemes


## AI and document processing

14. Should OpenRouter be treated as the fixed gateway for launch, or do we need a provider abstraction from day one?
- If there's a library that will seemlessly let us use OpenRouter, OpenAI, and other providers, sure. Otherwise, OpenRouter offers the most flexibility

15. Is there a preferred OCR/document extraction provider, or should the initial implementation use a local/open-source stack first?
- We'll probably need to use something from OpenRouter. I do have local LM Studio that could also simulate in dev

16. What level of human review is required when dec-page extraction confidence is low?
- A user will be guiding that process, so the import is "best effort", but the human needs to confirm

17. Should the AI be allowed to execute in-app actions automatically, or should actions always require user confirmation?
- Yes, if the permissions are enabled, it shoudl be able to execute in-app


## Billing and entitlements

18. Is Stripe billing based only on seats and plan tier, or do calls answered / minutes used also need to be billed from the start?
- Stripe has a new feature that allows token usage from LLM's to be passed on with a markup. research that, but we'll probably do that too. 

19. Are there annual contracts, trials, or implementation fees that need to exist in the billing model?
- not yet

20. Does "Standard+AI" gate only in-app AI, or also insured-portal AI and policy-review AI?
- only the in-app AI. the policy review AI is the app. gating it would be non-sensical

## Workflow behavior

21. What is the source of truth when AMS data conflicts with an uploaded declarations page?
- we'll display and let the human decide (assumeing we can get AMS access)

22. Should agencies be allowed to edit AI-extracted coverage/endorsement data manually after import?
- Yes

23. For policy review notes and activities, what fields are mandatory for a legally/usefully acceptable audit trail?
- I don't know

24. For cancellation and change requests, should the system create tickets/tasks internally in addition to email notifications?
- Yes, the policy reviews will offer different things the agency will need to follow up on. So a "session" with a customer won't be considered "closed" until the agency deems it so and closes open items. Providing quotes for additional coverages is an example.


## Telephony and call recording

25. Are call recordings always available from the phone provider, or does PRISM need to support agencies with no recording source?
- no calling

26. What are the consent, retention, and disclosure requirements for call recording by state?
- n/a
27. How should PRISM behave when an agency wants the AI to listen only, but not answer calls directly?
- n/a

## Data migration and onboarding

28. What does the first agency onboarding path look like in practice: manual setup by PRISM staff, spreadsheet import, AMS sync, or some combination?
- it depends on getting AMS access. Most likely an import of csv or spreadsheet

29. Do we need a formal sample/demo tenant with seeded users, insureds, policies, and reference data for sales and QA?
- it woudl be nice

30. How often should automated sync jobs run for policies, endorsements, and insured records once an AMS integration exists?
- daily (or more)
