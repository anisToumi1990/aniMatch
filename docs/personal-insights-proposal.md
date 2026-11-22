# Personal compatibility insights

Status: **proposal only (phase 1)**. Nothing in the app or the database changes yet.

When you open a match in Compatibility, today's screen shows a generic text from `compatibility_insight_templates`, picked only by score range and relationship type. Two pairs with the same score read the same thing. This proposal replaces it with texts **about the other person, from your point of view**:

- built from **their 5 trait scores** (latest quiz v2 result, else their animal's `animal_trait_profiles` row, the same rule as `compatibility_v2_traits()`),
- from **your differences** (your traits vs theirs),
- for the **relationship type** of the match (Lover / Business partner / Family),
- and from the pair's **4 area scores** already stored in `compatibility_results`.

All texts come from a fixed, reviewed library (no AI generation at runtime). Selection is deterministic: the same pair always sees the same texts until someone retakes the quiz or the content changes.

Sources in this branch:

- Content library: `supabase/content/personal-insights/library.json`
- Selection rules, validation and this doc's generated parts: `scripts/personal-insights-preview.js`

```
node scripts/personal-insights-preview.js            # validate + regenerate sections 2, 4 and the variety check
node scripts/personal-insights-preview.js --check    # validate only
node scripts/personal-insights-preview.js --pairs pairs.json   # real pairs, printed to stdout only
```

## 1. What the user sees

The match detail keeps the score, the avatars and the 4 area bars (`AreaBreakdown`). The generic template text is replaced by five blocks:

| Block | Size | Built from |
|---|---|---|
| **Who they are** | 1-2 sentences | Their 1-2 traits that stand out most |
| **Strengths** | 2-3 bullets | Their top traits, framed positively for this relationship type |
| **Challenges** | 1-2 bullets | Their traits that stand out *and* differ most from yours |
| **Tips** | 3 numbered tips | How to deal with them, what makes them give their best |
| **Your pair** | 1-2 sentences | Your biggest trait difference, then your weakest (or strongest) area |

**How we name them** (first name via the same rule as `lib/names.ts`: first name, else the part of the email before "@", else "Someone"):

| Relationship type | `{Label}` (first mention) | Later mentions |
|---|---|---|
| Lover | "Your partner {name}" | {name} / they |
| Business partner | "Your business partner {name}" | {name} / they |
| Family | "{name}" | {name} / they |

`{Label}` only opens "Who they are". Every other text uses `{name}`, and "they / their / them" with plural verbs. No he/she, no gendered words (boyfriend, wife…): the script rejects them.

**Tone rules** (checked by the script where possible):

- Clear first, warm second. One idea per sentence, no idioms that need a second read.
- Practical and specific: a tip is something you can do this week ("Thank them for a specific detail, not just 'good job'"), not a general wish.
- Low scores are a different style, not a flaw: low kindness = direct and honest, low chill = driven and intense, low social = quiet and attentive, low curiosity = grounded and practical, low organization = flexible and spontaneous.
- Strengths and challenges are about behavior, never about worth. Challenges always come with a tip that helps.
- No zodiac, horoscope, stars, fate or destiny wording (rejected by the script), no emojis.
- Length limits (with a 9-letter name): who 95 chars per fragment, strength 135, challenge 150, tip 180, difference 130, area 115.

**Privacy.** The texts reveal the other person's traits only in coarse form (high / medium / low on the traits that get picked) and only to someone they accepted an invite from. Raw scores never leave the database (section 5). Both people see texts about each other, so the exchange is symmetric. The app should say so in one line on the screen ("Based on both of your quiz results").

## 2. Content library

Dimensions: **trait (5) × level (3) × relationship type (3) × section (4)** = 180 texts, plus 30 difference texts, 5 "similar" texts, 24 area texts and 3 "balanced" fallbacks: **242 texts**.

Levels use the trait score (0-100): **high ≥ 60, medium 40-59, low < 40**. These match how the animal profiles are spread (most profile values are ≤ 40 or ≥ 60, so each animal gets clear highs and lows).

"Who they are" entries are fragments that follow `{Label}` or `{name}`, with a singular verb ("Your partner Sam *recharges* around people…").

<!-- generated:library -->
#### Social

**Social: high** (≥ 60)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | recharges around people and makes friends in minutes | {name} brings energy into your life together: new people, new plans, a full weekend if you want one. | A quiet evening at home can feel like a lost evening to {name}, and they may say yes to plans before checking with you. | Give {name} a social outlet without you having to be there every time. Encourage their nights out and they come home happier and more present. |
| Business partner | is at their best in front of people: clients, events, pitches | {name} opens doors. They network easily and can turn a cold contact into a warm one in a single conversation. | {name} can over-promise in the moment when a client is excited, and the follow-up work then lands on someone else. | Put {name} on the calls and meetings where people decide. Agree beforehand on what they can promise, so their energy closes deals you can deliver. |
| Family | is the one who brings everyone together | {name} keeps the family connected: they remember the gatherings, start the group chats and make sure nobody drifts away. | {name} may take it personally when you skip a family event or need some time alone. | When you can't come, tell {name} early and suggest another time to see each other. They care more about the connection than the specific event. |

**Social: medium** (40-59)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | is as happy at a party as on a quiet night in | {name} adapts easily to your social rhythm, whether you want a crowd or just the two of you. | Because {name} is fine either way, they may not say when they actually need people, or need a break from them. | Ask {name} directly: "Out or in tonight?" They often don't push for it, but they usually have a preference. |
| Business partner | can work a room or work alone, depending on what the job needs | {name} is comfortable with clients and just as comfortable with a quiet day of focused work. | {name} may not volunteer for the visible roles, even when they'd do them well. | Ask {name} to take one client-facing task this month. They're good at it, but they rarely ask for the spotlight. |
| Family | enjoys family time but also likes their own space | {name} shows up for the important moments without needing to be at every single one. | {name} may go quiet for a while without meaning anything by it, which can look like distance. | A short, regular check-in works well with {name}. Something like a weekly call keeps you close without feeling like an obligation. |

**Social: low** (< 40)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | recharges in quiet and prefers a few deep conversations to a crowd | {name} gives you their full attention. When you talk, they really listen, and they remember what you said. | Big groups and long parties drain {name}, even when they enjoy them, and they may need a quiet day after. | Plan time alone together, not just events. If you go to a party, agree on a time to leave so {name} can relax and enjoy it. |
| Business partner | does their best work with focus and few interruptions | {name} thinks before speaking. When they share an opinion in a meeting, it's usually well thought out. | {name} may not speak up in big meetings, so their best ideas can stay unsaid. | Ask {name} for their view one-on-one or in writing before a big meeting. You'll get their real thinking, not just a nod. |
| Family | shows love quietly rather than loudly | {name} is the calm, steady presence at family gatherings, the one who notices who's left out. | Long family days can tire {name} out, and they may leave early or go quiet. | Don't read {name}'s quietness as a lack of interest. A one-on-one coffee will mean more to them than a big family dinner. |

#### Curiosity

**Curiosity: high** (≥ 60)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | always wants to learn, try and explore something new | {name} keeps your relationship fresh: new places, new ideas, new things to talk about over dinner. | {name} gets bored with routine quickly and may push for change when you'd rather keep things as they are. | Plan one new experience together each month: a place, a class, a recipe. It feeds {name}'s curiosity and gives you shared stories. |
| Business partner | is full of ideas and always looking for a better way | {name} spots opportunities others miss and isn't afraid to question how things have always been done. | {name} may start new ideas before the current ones are finished. | Keep a shared "later" list for {name}'s new ideas. They feel heard, and the current project stays on track. |
| Family | loves new ideas, places and conversations | {name} is the one who suggests the trip, the new restaurant or the topic that gets the whole table talking. | {name} may find family traditions a bit repetitive and want to change them. | Let {name} plan part of the next family get-together. They'll bring something new, and they'll feel their ideas count. |

**Curiosity: medium** (40-59)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | enjoys new things but also values what already works | {name} is open to trying something new with you without needing constant change. | {name} may go along with your plans without saying what they'd really like to try. | Ask {name} to pick the next date idea. They have preferences, they just don't always push them. |
| Business partner | is open to new ideas when there's a good reason | {name} balances fresh ideas with common sense. They'll try something new, but they'll ask why first. | {name} may need a clear reason before joining a new idea, which can feel slow when you're excited. | When you pitch a new idea to {name}, lead with the problem it solves. They join fast once the reason is clear. |
| Family | likes some change, but not too much at once | {name} helps the family try new things without losing what makes it feel like home. | {name} can feel caught between the people who want change and those who want things as they are. | Ask {name} for their opinion when the family disagrees about plans. They often find the middle ground. |

**Curiosity: low** (< 40)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | is grounded, practical and happy with the simple things | {name} is steady and easy to be with. They don't need constant novelty to be happy with you. | {name} may resist new plans or changes, especially if they come with little warning. | Give {name} time to warm up to new ideas. Mention a plan a few days ahead instead of springing it on them. |
| Business partner | is practical and focused on what works today | {name} keeps the business grounded. They focus on what works and finish what they start. | {name} may push back on new ideas that haven't been tested yet. | Show {name} a concrete example or a small test before a big change. Proof convinces them more than vision. |
| Family | values traditions and things that have stood the test of time | {name} keeps family traditions alive, the recipes, the rituals, the yearly plans everyone counts on. | {name} may feel unsettled when the family changes plans or habits. | When something changes, explain to {name} what stays the same. Keeping one familiar thing makes change easier for them. |

#### Organization

**Organization: high** (≥ 60)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | likes plans, clear agreements and a tidy home | {name} makes life together run smoothly: bills paid, trips booked, plans that actually happen. | Last-minute changes and loose plans stress {name} more than they show. | If plans change, tell {name} as early as you can and suggest a new plan, not just a cancellation. They relax once there's a plan B. |
| Business partner | runs on lists, deadlines and clear processes | {name} is reliable. When they say it will be done by Friday, it's done by Friday. | {name} can get frustrated with partners who work in a looser way, and may end up redoing things themselves. | {name} gives their best with clear roles and deadlines. Agree in writing who does what, and stick to it. |
| Family | is the family's organizer, the one with the calendar | {name} remembers birthdays, plans the holidays and makes sure everyone knows where to be. | {name} may feel they're the only one keeping things together, and get tired of it. | Take one organizing task off {name}'s plate, and say thank you for the rest. Being noticed matters to them. |

**Organization: medium** (40-59)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | likes some structure but can go with the flow | {name} plans enough to keep things on track but can still say yes to a spontaneous evening. | {name} may expect you to share the planning without saying so out loud. | Split the planning clearly with {name}: one of you does trips, the other does weekends. It avoids quiet frustration. |
| Business partner | is organized when it counts and flexible when it doesn't | {name} adapts well: they can follow a process or improvise when a deal needs it. | {name} may not insist on structure until things start to slip. | Set a short weekly check-in with {name} to review priorities. It keeps you both on track before things slip. |
| Family | helps with plans without needing to control them | {name} is easy to plan with: they help when asked and don't fuss about the details. | {name} may leave the planning to others and then not love the result. | Ask {name} for one concrete thing when planning a family event. They're happy to help, they just wait to be asked. |

**Organization: low** (< 40)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | is spontaneous and happy to see where the day goes | {name} keeps life fun and flexible. A rainy Sunday can turn into an adventure with them. | {name} may forget dates, run late or leave plans to the last minute. | Put important dates in a shared calendar with reminders. It's not about trust: it frees {name} to be spontaneous without missing what matters. |
| Business partner | is flexible, quick and good at improvising | {name} handles surprises well. When a plan breaks, they find another way, fast. | Deadlines and paperwork are not {name}'s favorite, and they can slip when no one checks in. | Give {name} short deadlines and quick check-ins instead of one big due date. They do great work in sprints. |
| Family | is relaxed about plans and happy to improvise | {name} stays calm when family plans fall apart. They're the one who says "we'll figure it out." | {name} may confirm late, forget a date or change plans last minute. | Send {name} a short reminder the day before family plans. It helps them show up, and it avoids a last-minute scramble. |

#### Kindness

**Kindness: high** (≥ 60)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | is warm, caring and quick to notice how you feel | {name} notices when something is off with you, often before you say a word. | {name} may put your needs before their own and not say when they're hurt or tired. | Ask {name} what they need, and mean it. They're so used to caring for others that a simple "How are you, really?" goes a long way. |
| Business partner | is supportive and puts people first | {name} builds trust with clients and colleagues. People like working with them and come back. | {name} may avoid hard conversations, like asking for money or saying no to a client. | {name} gives their best when their effort is recognized. Thank them for a specific detail, not just "good job". |
| Family | is the caring heart of the family | {name} is the person everyone calls when something goes wrong. They always make time. | {name} may take on everyone's problems and end up exhausted. | Return the care: check on {name} when nothing is wrong. They rarely ask for help, so offer it. |

**Kindness: medium** (40-59)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | is caring but also honest about what they think | {name} is kind without being a pushover. They'll support you and still tell you the truth. | {name} may sound blunter than they mean when they're tired or stressed. | If something {name} says stings, ask what they meant before reacting. The intention is usually kinder than the words. |
| Business partner | is fair, friendly and clear about expectations | {name} balances people and results. They're pleasant to work with and still hold the line on quality. | {name} may hold back feedback to keep the peace, then let it out all at once. | Make feedback a regular habit with {name}, in both directions. Small notes often beat one big talk. |
| Family | cares about the family and also speaks their mind | {name} supports the family and isn't afraid to say when something isn't fair. | {name}'s honesty can lead to tension at family gatherings. | When {name} raises a concern, take it seriously. They speak up because they care, not to start a fight. |

**Kindness: low** (< 40)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | is direct, honest and says what they think | You always know where you stand with {name}. They don't play games or hide what they feel. | {name}'s honesty can come out harsher than they intend, especially in an argument. | Tell {name} when their words hurt, calmly and clearly. They respect directness and will usually adjust once they know. |
| Business partner | is direct, objective and focused on results | {name} makes tough calls without getting stuck on feelings. Negotiations are their strong suit. | {name} can come across as cold to clients or colleagues who need more warmth. | Be direct with {name}: say what you need in one sentence. They appreciate clarity much more than diplomacy. |
| Family | is the honest one who says what others only think | {name} gives the family straight answers and practical help, without drama. | {name} may seem distant or blunt, especially in emotional family moments. | {name} shows care through actions more than words. Notice what they do for you, and tell them you noticed. |

#### Chill

**Chill: high** (≥ 60)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | is easygoing and hard to rattle | {name} stays calm when things go wrong. Stress at home rarely turns into a fight with them. | {name} may let problems slide for too long because they don't want to make a fuss. | Bring up issues with {name} early and calmly. They won't start the conversation, but they're happy to have it. |
| Business partner | stays relaxed under pressure | {name} keeps a cool head in tense negotiations and tight deadlines, which calms the whole team. | {name} may seem too relaxed when something is actually urgent. | When something is urgent, say so clearly to {name}, with a deadline. They'll act fast once they know it matters. |
| Family | is the calm one when family life gets busy | {name} lowers the temperature in family arguments. People feel calmer around them. | {name} may avoid family tension instead of helping solve it. | Ask {name} directly what they think when the family disagrees. Their calm view helps, but they rarely offer it unprompted. |

**Chill: medium** (40-59)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | is mostly relaxed but has a fire when it matters | {name} lets small things go but stands firm on what really matters to them. | When {name} does get upset, it can surprise you, because it doesn't happen often. | When {name} gets heated, it usually means this topic really matters to them. Slow down and listen first. |
| Business partner | is steady, with drive when the stakes are high | {name} keeps a steady pace and can push hard when a deadline or a deal requires it. | {name} may switch from calm to intense quickly when something goes wrong. | Agree with {name} on what counts as urgent. It helps you both know when to push and when to relax. |
| Family | is calm most of the time but cares deeply | {name} stays easygoing day to day, but steps up when the family really needs them. | {name} may hold back irritation until it builds up. | Check in with {name} after a stressful family event. Small frustrations are easier to talk about before they build up. |

**Chill: low** (< 40)

| Type | Who they are ("{Label} …") | Strength | Challenge | Tip |
|---|---|---|---|---|
| Lover | is intense, passionate and driven | {name} feels things deeply and brings real passion to your relationship and to their goals. | {name} reacts fast, and small disagreements can heat up quickly. | When things heat up with {name}, suggest a short break and come back to it. They calm down fast once they've had a moment. |
| Business partner | is driven, fast and ambitious | {name} pushes the business forward. They bring urgency and won't settle for slow progress. | {name} can get impatient with slower partners or with plans that take time. | {name} gives their best with ambitious goals. Share the big target with them, then agree on the steps together. |
| Family | is passionate and quick to act | {name} gets things done for the family. When something needs fixing, they're already on it. | {name} may react strongly in family arguments, then calm down just as fast. | Don't take {name}'s first reaction as their final word. Give them a little time, then talk it through. |

#### Balanced (no trait stands out)

| Type | Who they are ("{Label} …") |
|---|---|
| Lover | has a balanced personality, with no extreme in any direction |
| Business partner | is a well-rounded partner who can adapt to most situations |
| Family | is balanced and easy to get along with in most situations |

#### Differences ("Your pair", sentence 1)

Used when the biggest gap is ≥ 20 points. "They" = the match, "you" = the viewer.

| Trait | Direction | Lover | Business partner | Family |
|---|---|---|---|---|
| Social | They score higher | {name} needs more people and plans than you do. | {name} is more outgoing than you, so they're a natural fit for the client-facing side. | {name} wants more family time and gatherings than you do. |
| Social | You score higher | You need more people and plans than {name} does. | You're the more outgoing one, while {name} prefers focused work behind the scenes. | You enjoy big family gatherings more than {name} does. |
| Curiosity | They score higher | {name} craves new experiences more than you do. | {name} brings more new ideas than you, and you're the one who checks them against reality. | {name} likes trying new things more than you do. |
| Curiosity | You score higher | You crave new experiences more than {name} does. | You bring more new ideas, while {name} keeps the focus on what already works. | You like trying new things more than {name} does. |
| Organization | They score higher | {name} is the planner of the two of you, and you're the more spontaneous one. | {name} is the more structured of you two, and you're quicker to improvise. | {name} likes plans settled earlier than you do. |
| Organization | You score higher | You're the planner of the two of you, and {name} is the more spontaneous one. | You're the more structured of you two, and {name} is quicker to improvise. | You like plans settled earlier than {name} does. |
| Kindness | They score higher | {name} is softer than you, and you're the more direct one. | {name} leads with warmth, and you lead with directness. | {name} tends to soften things, and you tend to say them straight. |
| Kindness | You score higher | You're softer than {name}, and they're the more direct one. | You lead with warmth, and {name} leads with directness. | You tend to soften things, and {name} tends to say them straight. |
| Chill | They score higher | {name} is more easygoing than you, and you're the more intense one. | {name} stays calmer under pressure, and you bring more urgency. | {name} is calmer than you when family life gets tense. |
| Chill | You score higher | You're more easygoing than {name}, and they're the more intense one. | You stay calmer under pressure, and {name} brings more urgency. | You're calmer than {name} when family life gets tense. |

#### Similar (no gap ≥ 20 points; the closest trait)

| Trait | Text (all types) |
|---|---|
| Social | You and {name} like the same amount of social time, so plans are easy to agree on. |
| Curiosity | You and {name} have the same appetite for new things. |
| Organization | You and {name} plan in a similar way, which removes a classic source of friction. |
| Kindness | You and {name} handle feelings in a similar way. |
| Chill | You and {name} react to stress in a similar way. |

#### Areas ("Your pair", sentence 2)

| Area | Case | Lover | Business partner | Family |
|---|---|---|---|---|
| communication | strongest, ≥ 70 (none < 55) | You understand each other easily, which makes hard talks easier. | You communicate well, so decisions don't get stuck in misunderstandings. | You understand each other easily, even on sensitive family topics. |
| communication | weakest, < 55 | Communication is where you need the most care: check what the other meant before reacting. | Communication is your weak spot, so put key decisions in writing. | Misunderstandings happen easily between you, so ask before assuming. |
| energy | strongest, ≥ 70 (none < 55) | You like the same pace, so planning time together is easy. | You work at the same pace, which keeps projects moving. | You enjoy the same kind of time together. |
| energy | weakest, < 55 | Your energy levels differ the most, so take turns choosing how you spend your time. | Your work rhythms differ, so agree on working hours and response times. | You enjoy different kinds of time together, so mix quiet visits and bigger plans. |
| conflict | strongest, ≥ 70 (none < 55) | You handle disagreements well and calm down fast. | You handle disagreements well, which matters when money is on the line. | You handle family disagreements well and don't hold grudges. |
| conflict | weakest, < 55 | Arguments can escalate fast between you, so agree now on how to take a break. | Disagreements can escalate between you, so agree in advance on how you'll settle them. | Disagreements can heat up quickly, so pause and come back to them later. |
| values | strongest, ≥ 70 (none < 55) | You want the same things from life, which is a solid base. | You share the same goals and standards for the business. | You share the same values about family, which keeps you close. |
| values | weakest, < 55 | Your priorities differ the most, so talk about the big plans early. | Your goals for the business may differ, so write down a shared plan. | You see some family priorities differently, so talk about expectations openly. |
<!-- /generated:library -->

## 3. Selection rules

Inputs: their traits **T**, your traits **M** (both 0-100), relationship type **R**, the stored area scores **A**, their first name. Every step is deterministic; ties always go in this order: social, curiosity, organization, kindness, chill (areas: communication, energy, conflict, values).

Definitions:

- **level(t)** = high (T ≥ 60), medium (40-59) or low (< 40). The text for a trait is always the one for *their* level.
- **stand-out(t)** = |T(t) − 50|. A trait "stands out" when stand-out ≥ 10.
- **gap(t)** = T(t) − M(t). Positive: they score higher than you.

Steps:

1. **Who they are.** Sort traits by stand-out. Sentence 1 = `{Label}` + who-text of the top trait. Sentence 2 = `{name}` + who-text of the 2nd trait, only if it also stands out. If no trait stands out, use the "balanced" text.
2. **Strengths.** The top 2 traits by stand-out, plus the 3rd if it stands out. One strength text each.
3. **Challenges.** Score each trait by stand-out + 0.5 × |gap|: a challenge matters most when it's a strong trait *and* far from yours. Take the top one, plus the 2nd if its score ≥ 25.
4. **Tips (always 3, on 3 different traits).** (a) their top trait: what makes them give their best; (b) the trait with your biggest |gap| not used yet: how to handle the difference; (c) their first challenge trait if not used yet. Missing slots are filled with the next traits by stand-out.
5. **Your pair.** Sentence 1: if the biggest |gap| is ≥ 20 points, the difference text for that trait and direction ("they score higher" / "you score higher"), else the "similar" text for the trait where you're closest. Sentence 2: if the weakest area is < 55, its "weak" text (advice); else, if the strongest area is ≥ 70, its "strong" text; otherwise (all areas 55-69) no second sentence, rather than overclaiming. v1 rows (no stored areas) skip sentence 2.

**No repeats.** Within a screen, every text is used once: each section draws from its own column, the 3 tips are on 3 different traits, and the script checks it on 5,000 simulated pairs. The same trait can appear as a strength and as a challenge: that's intended, since a trait's upside and downside usually go together ("organized" and "stressed by last-minute changes").

**Missing data.** If the other person has no quiz result, the screen keeps today's state (no insights). If their result is v1, their animal's profile is used, so all users get insights.

## 4. Examples

### Real pairs (Omar's matches): pending

These can't be generated from this branch. The app only has the anon key, and RLS rightly stops a user from reading anyone else's `trait_scores`. To generate them, run this read-only query in the Supabase SQL editor (replace the email), save the result as `pairs.json` outside the repo, and run `node scripts/personal-insights-preview.js --pairs pairs.json`:

```sql
-- Read-only. Returns up to 3 of your matches with both trait sets and the stored areas.
select jsonb_pretty(coalesce(jsonb_agg(p), '[]'::jsonb))
from (
  select
    public.notification_first_name(other.id) as name,
    r.relationship_type,
    public.compatibility_v2_traits(me.id) as me,
    public.compatibility_v2_traits(other.id) as them,
    case when r.compatibility_version = 2 then jsonb_build_object(
      'communication', r.communication_score, 'energy', r.energy_score,
      'conflict', r.conflict_score, 'values', r.values_score
    ) end as areas
  from public.profiles me
  join public.compatibility_results r on me.id in (r.user_a_id, r.user_b_id)
  join public.profiles other on other.id = case when r.user_a_id = me.id then r.user_b_id else r.user_a_id end
  where me.email = '<your email>'
  order by r.created_at desc
  limit 3
) p;
```

The script prints the insights to the terminal only. Committing them would put other people's names and personality reads in the repo history, so by default they stay out of this doc (see the open question in section 6).

### Profile-only examples (no real users)

These use the animal profiles from `animal_trait_profiles` as stand-ins for two people, with made-up names. This is exactly what a pair of v1 users would see. The small line under each example shows which library entries were picked.

<!-- generated:examples -->
#### Lover: you are an Owl, Sam is a Dolphin

Input: them (Dolphin) Social 78 · Curiosity 58 · Organization 42 · Kindness 72 · Chill 48; you (Owl) Social 28 · Curiosity 66 · Organization 64 · Kindness 50 · Chill 68; areas communication 58, energy 49, conflict 75, values 72.

**Who they are.** Your partner Sam recharges around people and makes friends in minutes. Sam is warm, caring and quick to notice how you feel.

**Strengths**
- Sam brings energy into your life together: new people, new plans, a full weekend if you want one.
- Sam notices when something is off with you, often before you say a word.

**Challenges**
- A quiet evening at home can feel like a lost evening to Sam, and they may say yes to plans before checking with you.
- Sam may put your needs before their own and not say when they're hurt or tired.

**Tips**
1. Give Sam a social outlet without you having to be there every time. Encourage their nights out and they come home happier and more present.
2. Split the planning clearly with Sam: one of you does trips, the other does weekends. It avoids quiet frustration.
3. Ask Sam what they need, and mean it. They're so used to caring for others that a simple "How are you, really?" goes a long way.

**Your pair.** Sam needs more people and plans than you do. Your energy levels differ the most, so take turns choosing how you spend your time.

<sub>Picked: who = social high, kindness high; strengths = social high, kindness high; challenges = social high, kindness high; tips = social high, organization medium, kindness high; pair = difference social they_higher (50 pts), energy weak (49).</sub>

#### Business partner: you are an Eagle, Alex is an Otter

Input: them (Otter) Social 66 · Curiosity 58 · Organization 30 · Kindness 58 · Chill 72; you (Eagle) Social 42 · Curiosity 50 · Organization 78 · Kindness 30 · Chill 46; areas communication 61, energy 68, conflict 47, values 55.

**Who they are.** Your business partner Alex stays relaxed under pressure. Alex is flexible, quick and good at improvising.

**Strengths**
- Alex keeps a cool head in tense negotiations and tight deadlines, which calms the whole team.
- Alex handles surprises well. When a plan breaks, they find another way, fast.
- Alex opens doors. They network easily and can turn a cold contact into a warm one in a single conversation.

**Challenges**
- Deadlines and paperwork are not Alex's favorite, and they can slip when no one checks in.
- Alex may seem too relaxed when something is actually urgent.

**Tips**
1. When something is urgent, say so clearly to Alex, with a deadline. They'll act fast once they know it matters.
2. Give Alex short deadlines and quick check-ins instead of one big due date. They do great work in sprints.
3. Put Alex on the calls and meetings where people decide. Agree beforehand on what they can promise, so their energy closes deals you can deliver.

**Your pair.** You're the more structured of you two, and Alex is quicker to improvise. Disagreements can escalate between you, so agree in advance on how you'll settle them.

<sub>Picked: who = chill high, organization low; strengths = chill high, organization low, social high; challenges = organization low, chill high; tips = chill high, organization low, social high; pair = difference organization you_higher (48 pts), conflict weak (47).</sub>

#### Family: you are a Deer, Noor is a Lion

Input: them (Lion) Social 70 · Curiosity 36 · Organization 68 · Kindness 44 · Chill 58; you (Deer) Social 28 · Curiosity 44 · Organization 40 · Kindness 78 · Chill 38; areas communication 61, energy 55, conflict 61, values 64.

**Who they are.** Noor is the one who brings everyone together. Noor is the family's organizer, the one with the calendar.

**Strengths**
- Noor keeps the family connected: they remember the gatherings, start the group chats and make sure nobody drifts away.
- Noor remembers birthdays, plans the holidays and makes sure everyone knows where to be.
- Noor keeps family traditions alive, the recipes, the rituals, the yearly plans everyone counts on.

**Challenges**
- Noor may take it personally when you skip a family event or need some time alone.
- Noor may feel they're the only one keeping things together, and get tired of it.

**Tips**
1. When you can't come, tell Noor early and suggest another time to see each other. They care more about the connection than the specific event.
2. When Noor raises a concern, take it seriously. They speak up because they care, not to start a fight.
3. Take one organizing task off Noor's plate, and say thank you for the rest. Being noticed matters to them.

**Your pair.** Noor wants more family time and gatherings than you do.

<sub>Picked: who = social high, organization high; strengths = social high, organization high, curiosity low; challenges = social high, organization high; tips = social high, kindness medium, organization high; pair = difference social they_higher (42 pts), no area sentence (all areas 55-69).</sub>
<!-- /generated:examples -->

## 5. Technical plan (phase 2)

### Database

**Content tables** (seeded from `library.json` by a build script, like the daily aura content):

- `personal_insight_trait_texts`: `trait`, `level` (high/medium/low), `relationship_type`, `section` (who/strength/challenge/tip), `text`, `is_active`, unique on (trait, level, relationship_type, section).
- `personal_insight_pair_texts`: `kind` (difference / similar / area / balanced), `key` (trait or area), `variant` (they_higher / you_higher / strong / weak, or null), `relationship_type` (null for "similar"), `text`.
- Both tables: RLS enabled **with no client policies**, and `revoke all ... from anon, authenticated`. Clients never read the library; only the function does.

**`get_personal_insights(p_result_id uuid) returns jsonb`**:

- `language plpgsql`, `stable`, `security definer`, `set search_path = public` (same pattern as the hardened RPCs in `20261121090000_security_hardening.sql`).
- Loads the `compatibility_results` row. Raises "not allowed" unless `auth.uid()` is `user_a_id` or `user_b_id` (no null-uid exception here: the SQL editor can call `compatibility_v2_traits` directly).
- "Me" = the caller, "them" = the other user. Traits from `compatibility_v2_traits()` for both, so v1 users fall back to their animal's profile.
- First name from `notification_first_name()` (same rule as `lib/names.ts`).
- Applies the section 3 rules, fills `{Label}` / `{name}` and returns **only finished texts**:
  ```json
  { "version": 1, "who": "…", "strengths": ["…"], "challenges": ["…"], "tips": ["…", "…", "…"], "pair": "…" }
  ```
  No scores, no levels, no trait names, no picks. Returns `null` if either person has no traits.
- `revoke execute ... from public, anon; grant execute ... to authenticated;`
- Computed on read (a few small lookups), not stored: content fixes and quiz retakes show up immediately, and there's no extra table holding derived personality data.

**Keeping it correct**, like compatibility v2: a pure TypeScript reference (`lib/personalInsights.ts`, same rules as `buildInsights` in the script), a shared fixture generated by the script, a Jest test, and a SQL check migration that compares the function's output for the fixture inputs. The check runs the internal selection on fixture traits, so it needs an internal helper (`personal_insights_build(me jsonb, them jsonb, type text, name text, areas jsonb)`) with **no client execute**; `get_personal_insights` is just the access check plus that helper.

### App

- `app/(tabs)/compatibility.tsx`: replace `fetchInsight` (the `compatibility_insight_templates` query) with
  `supabase.rpc('get_personal_insights', { p_result_id: result.id })` (Supabase JS v1: `{ data, error }`).
- New `components/compatibility/PersonalInsights.tsx` renders the 5 blocks under `AreaBreakdown`, with the one-line "Based on both of your quiz results" note. Loading and error states match the current insight block.
- If the RPC returns `null` or fails, fall back to today's template text during the rollout, then remove `compatibility_insight_templates` usage once the content is live.
- Share cards are unchanged (insights are personal, not for sharing).

### Rollout

1. Migration: content tables + seed (generated) + function + check.
2. App release reading the RPC with the template fallback.
3. After a release cycle, drop the fallback; keep `compatibility_insight_templates` in the database until nothing reads it.

## 6. Open questions

1. **Real examples in the repo.** Should the 3 real pairs go into this doc with first names (they're your friends and family, and the repo is shared with a collaborator), with initials only, or stay out of git and just be reviewed in the terminal?
2. **Thresholds.** High ≥ 60 / low < 40 and the "stand out" cutoff of 10 are tuned on animal profiles; worth re-checking on real v2 scores once there are enough.
3. **One text per cell.** Each cell has one text, so two people with the same top traits read the same strength. A second variant per cell (picked by a hash of the pair) would add variety for about 180 more texts.
4. **Both directions.** Should "Your pair" also show a line about *you* from their point of view ("{name} may find you…")? It's useful but more sensitive; proposed for later.

## Variety check

<!-- generated:variety -->
5000 simulated pairs (random animal profile + noise, sd 12 per trait, types in rotation):

- 4774 different screens out of 5000; no screen repeats a text (checked).
- 135 of 135 strength / challenge / tip texts get used at least once.
- 3 strengths: 83% of screens; 2 challenges: 84%.
- "Balanced" who-text: 0%; "similar" pair sentence: 4%.
<!-- /generated:variety -->
