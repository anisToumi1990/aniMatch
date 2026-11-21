# Quiz v2 proposal: trait-based matching

Status: **proposal only (phase 1)**. Nothing in the app or the database changes yet.
Simulation: `scripts/quiz-v2-simulation.js`.

## How it works

- The quiz measures 5 traits, each scored 0–100:
  **Social energy (S)**, **Curiosity (C)**, **Organization (O)**, **Kindness (K)**, **Calm (Ca)**.
- 15 scenario questions, 3 per trait. Each answer is worth 3, 2, 1 or 0 points on that question's trait.
- Trait score = points earned / points possible × 100. With 3 questions that's 0, 11, 22, … 100.
- Each of the 15 animals has an ideal profile on the same 5 traits.
- The user's animal is the profile with the smallest Euclidean distance to their scores.
  Users still see **one** animal; the trait scores can stay internal (or become a later "your aura breakdown" feature).
- If the 2 closest animals are nearly tied, we ask up to 3 tie-breaker questions (see section 4).

**Not obvious, not judgmental.** The 0-point answers are positive ways to be (recharging alone, loving routine, being direct, being driven), not wrong answers. Questions are shown in a shuffled order and the answers within each question are shuffled too, so the 3/2/1/0 order isn't visible. Points are never shown to the user.

## 1. Questions

Points are for the question's trait only.

### Social energy (S)

**Q1. A friend texts: "Surprise party tonight. You in?"**
| Answer | S |
|---|---|
| I'm bringing the playlist and three more people. | 3 |
| Obviously. I'll probably be the last one to leave. | 2 |
| I'll stop by for an hour and catch up with the host. | 1 |
| I'll send a gift and a voice note, then celebrate one-on-one next week. | 0 |

**Q2. Long train ride. The stranger next to you is very chatty.**
| Answer | S |
|---|---|
| Best ride ever, we swap life stories. | 3 |
| A good chat for a while, then headphones. | 2 |
| Friendly but short, then back to the view. | 1 |
| Window seat, headphones, a whole movie: my favorite kind of trip. | 0 |

**Q3. Your perfect Saturday night recharge:**
| Answer | S |
|---|---|
| A packed concert or a big night out. | 3 |
| Dinner with a group of good friends. | 2 |
| Movie night with one or two close people. | 1 |
| A cozy solo night with a project, game or book. | 0 |

### Curiosity (C)

**Q4. Day one in a city you've never been to:**
| Answer | C |
|---|---|
| No map. I'll see where I end up. | 3 |
| Hunt down the hidden spots locals recommend. | 2 |
| The famous sights. They're famous for a reason. | 1 |
| Find a café I love and make it my base for the week. | 0 |

**Q5. The menu has a dish you've never heard of.**
| Answer | C |
|---|---|
| Ordering it. The weirder the better. | 3 |
| Ask the waiter about it, then probably try it. | 2 |
| Steal a bite from a friend's plate before I commit. | 1 |
| My usual. I know exactly what I love. | 0 |

**Q6. A free afternoon, phone on silent:**
| Answer | C |
|---|---|
| Fall down a rabbit hole on a random topic (octopus brains, anyone?). | 3 |
| Try a new hobby I saw online. | 2 |
| Get better at something I already do. | 1 |
| Rewatch my comfort show. | 0 |

### Organization (O)

**Q7. Moving day is next week.**
| Answer | O |
|---|---|
| Spreadsheet, labeled boxes, color codes. | 3 |
| A checklist and a few boxes every day. | 2 |
| A rough plan and one big packing push the night before. | 1 |
| Everything into boxes, I'll figure it out at the new place. | 0 |

**Q8. Your phone's home screen is…**
| Answer | O |
|---|---|
| Folders by category. I could find anything with my eyes closed. | 3 |
| Mostly tidy, with a few strays. | 2 |
| Whatever I used last is up front. | 1 |
| A beautiful chaos only I understand. | 0 |

**Q9. A group trip with friends needs planning.**
| Answer | O |
|---|---|
| I'm making the shared itinerary, backup options included. | 3 |
| I'll book the big stuff and keep the days open. | 2 |
| I'll go with whatever the group decides. | 1 |
| Plans? We'll pick the destination at the station. | 0 |

### Kindness (K)

Low-kindness answers are framed as directness, fairness or honesty, not as being mean.

**Q10. A friend shows you their new business idea. It has a big flaw.**
| Answer | K |
|---|---|
| Cheer them on first, then help them fix it together. | 3 |
| Point out the flaw gently, with a few ideas. | 2 |
| Ask sharp questions until they spot it themselves. | 1 |
| Tell them straight: better from me now than from the market later. | 0 |

**Q11. Group project, and one person keeps falling behind.**
| Answer | K |
|---|---|
| Check in with them privately. Maybe something's going on. | 3 |
| Offer to take a piece of their work. | 2 |
| Re-split the tasks so the deadline is safe. | 1 |
| Raise it with the group. Fair is fair. | 0 |

**Q12. The last slice of pizza, and a friend is eyeing it.**
| Answer | K |
|---|---|
| It's theirs before they even ask. | 3 |
| Half for you, half for me. | 2 |
| Rock-paper-scissors for it. | 1 |
| Sorry, I've been thinking about this slice all day. | 0 |

### Calm (Ca)

Low-calm answers are framed as drive and reacting fast, not as panic.

**Q13. Your flight is delayed 4 hours.**
| Answer | Ca |
|---|---|
| A quiet corner and some bonus free time. Nice. | 3 |
| One sigh, then snacks and a movie. | 2 |
| Check every other flight option, just in case. | 1 |
| Already at the desk, making things happen. | 0 |

**Q14. Ten minutes before a big presentation:**
| Answer | Ca |
|---|---|
| Relaxed. It'll go how it goes. | 3 |
| A few deep breaths and I'm ready. | 2 |
| One more run-through of the slides. | 1 |
| Buzzing with nerves, which is exactly my fuel. | 0 |

**Q15. Someone cuts in front of you in a long queue.**
| Answer | Ca |
|---|---|
| Not worth my energy. I let it go. | 3 |
| A light joke about it, then I move on. | 2 |
| A polite "Excuse me, the line starts back there." | 1 |
| I call it out on the spot. Someone has to. | 0 |

## 2. Animal profiles

Based on `animal_auras.description` / `traits` in Supabase. These are the **final, tuned** values (section 3).

| Animal | S | C | O | K | Ca | Why |
|---|---|---|---|---|---|---|
| Dolphin | 78 | 58 | 42 | 72 | 48 | Playful, friendly social butterfly with high emotional intelligence; a little sensitive. |
| Peacock | 74 | 50 | 60 | 30 | 34 | Charismatic, stylish self-expression; puts effort into presentation, seeks attention. |
| Lion | 70 | 36 | 68 | 44 | 58 | Confident, decisive leader who takes charge; steady under pressure, can be domineering. |
| Fox | 60 | 74 | 36 | 34 | 52 | Clever, adaptable, witty; improvises rather than plans, persuasive more than soft. |
| Parrot | 76 | 66 | 30 | 54 | 32 | Talkative, fun-loving life of the party; enthusiastic and impulsive. |
| Owl | 28 | 66 | 64 | 50 | 68 | Wise, introverted, analytical observer; patient, thinks before acting. |
| Wolf | 54 | 30 | 62 | 70 | 34 | Loyal, protective, pack-focused; strong-willed and wary of outsiders. |
| Bear | 26 | 32 | 68 | 56 | 70 | Strong, independent, responsible, patient; a solid introvert who likes the known. |
| Unicorn | 46 | 76 | 32 | 66 | 50 | Dreamy, creative visionary; idealistic and warm, not into practical details. |
| Elephant | 50 | 40 | 62 | 76 | 70 | Kind, dependable, family-oriented, wise; gentle strength. |
| Snake | 28 | 62 | 54 | 30 | 64 | Mysterious, intuitive strategist; independent, keeps people at a distance. |
| Cat | 26 | 70 | 34 | 38 | 46 | Independent, curious, selective about companions; can seem aloof. |
| Eagle | 42 | 50 | 78 | 30 | 46 | Ambitious, focused, goal-driven, competitive. |
| Deer | 28 | 44 | 40 | 78 | 38 | Gentle, empathetic, nurturing; sensitive and startled by conflict. |
| Otter | 66 | 58 | 30 | 58 | 72 | Playful, lighthearted, spontaneous; finds joy in simple things, not a worrier. |

Each animal also has one standout trait the others don't share in the same combination, e.g. Eagle is the most organized but low on kindness, Elephant is kind *and* calm, Deer is kind but not calm.

## 3. Simulation

`node scripts/quiz-v2-simulation.js [users] [seed]` simulates users who pick every answer at random, runs the matching and the tie rule, and prints the share per animal. It exits with an error if any animal ends up outside 3–12%.

**How the profiles were tuned:** first drafted from the descriptions above, then adjusted with the script. Random answers pile up near the middle (each trait averages 50), so animals with extreme profiles were too rare (Parrot, Unicorn, Snake, Owl were ~4%) and animals with middling profiles too common (Wolf, Peacock ~9.5%). The rare ones were moved a few points toward the middle and the common ones a few points out, while keeping each animal's character.

**Final result** (10,000 users, seed 42, tie gap 2):

| Animal | Before tie-breakers | Final |
|---|---|---|
| Wolf | 9.3% | 9.4% |
| Lion | 8.5% | 8.6% |
| Deer | 8.3% | 8.1% |
| Otter | 7.6% | 8.0% |
| Peacock | 7.5% | 7.6% |
| Cat | 7.4% | 7.2% |
| Eagle | 7.2% | 7.1% |
| Fox | 6.4% | 6.3% |
| Owl | 5.7% | 5.7% |
| Elephant | 5.7% | 5.7% |
| Bear | 5.6% | 5.5% |
| Snake | 5.2% | 5.2% |
| Unicorn | 5.3% | 5.2% |
| Dolphin | 5.4% | 5.1% |
| Parrot | 5.0% | 5.0% |

Range **5.0%–9.4%**, inside the 3–12% goal. Seeds 7 and 2026 and a 100,000-user run land between 4.8% and 8.8%.

**Caveat:** real people don't answer at random. Some answers will be more popular (e.g. "half for you, half for me"), which will skew the split. Once v2 is live, we should log the trait scores and re-tune the profiles from real data, re-running this script with the real answer frequencies.

## 4. Tie rule

- After the 15 questions, rank animals by distance.
- **Tie** = 2nd distance − 1st distance **< 2** (distance in trait points).
  - Gap 2 means ~20% of users get at least one extra question. Gap 4 would be ~37%, gap 1.5 ~16%.
- Ask tie-breakers on the traits where the two tied animals' profiles differ the most, biggest difference first. Each answer is added to that trait (it now has 4 questions, so the score is points / 12 × 100), and the ranking is recomputed.
- Stop as soon as the gap is ≥ 2, or after 3 tie-breakers. If it's still close after 3, the closest animal wins.

Simulated (10,000 users): 15.4% need 1 tie-breaker, 3.1% need 2, 1.5% need 3. 0.8% are still close after 3. The tie-breakers change the animal for 10.2% of users.

### Tie-breaker questions (one per trait, same 3/2/1/0 scale)

**TB-S. You win a weekend trip. You bring…**
| Answer | S |
|---|---|
| Ten people. Let's go. | 3 |
| My four closest friends. | 2 |
| One favorite person. | 1 |
| Just me. Finally, a solo trip. | 0 |

**TB-C. A mystery box arrives with no label.**
| Answer | C |
|---|---|
| Open it right now. | 3 |
| Shake it, guess, then open it. | 2 |
| Find out who sent it first. | 1 |
| It waits until I know what it is. | 0 |

**TB-O. Your desk right now:**
| Answer | O |
|---|---|
| Everything has its place. | 3 |
| Tidy enough. | 2 |
| Organized piles. | 1 |
| A creative explosion. | 0 |

**TB-K. A friend cancels on you last minute. Again.**
| Answer | K |
|---|---|
| "No worries! Hope you're okay." | 3 |
| "All good, let's reschedule." | 2 |
| "Sure, but next time you pick the place and pay." | 1 |
| I tell them honestly that it bugs me. | 0 |

**TB-Ca. The wifi dies in the middle of your show.**
| Answer | Ca |
|---|---|
| Perfect excuse for a nap. | 3 |
| I'll read until it's back. | 2 |
| Restart the router. Twice. | 1 |
| On the phone with the provider within a minute. | 0 |

## Open questions for phase 2

- Storage: new tables (`quiz_v2_questions`, `quiz_v2_answers`, `animal_trait_profiles`) vs. reusing `answer_animal_mapping`. Saving the 5 trait scores in `user_quiz_results` would also allow a trait breakdown and better compatibility later.
- Existing users: keep their v1 animal until they retake the quiz, or invite them to retake.
- Compatibility: still animal-based for now. Trait distance could become a finer compatibility score later.
