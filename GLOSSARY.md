# simonbrunou.bzh

Simon Brunou's personal site and CV. One shared data file feeds the homepage and the CV.

## Language

**Visitor**:
A recruiter or prospective client who already has Simon's name or CV and is deciding, in about 30 seconds, whether to get in touch.
_Avoid_: user, audience, reader

**Featured project**:
A product Simon built and shipped himself, shown first on the homepage as the main evidence of his work. In `data.js`, a project with screenshots (`shots`); the others get one line under the Bands.
_Avoid_: open source, side project, portfolio item

**Band**:
A full-width homepage section in one Featured project's own colours, its Band palette, with its screenshots running off the edge. Bands alternate sides by position: every second one is mirrored and runs its screenshots off the left edge. The Main job gets a slate band. The design language is named Bands after it.
_Avoid_: card, panel, project tile

**Band palette**:
The colours of one Featured project, taken from its app: ground, text, soft text, accent, the field behind the screenshots and the screenshot shadow. Written on the project in `data.js`; its Band and its CV strip both use it.
_Avoid_: theme, brand colours

**Main job**:
The job Simon held longest, counted from the start of the first position there to the end of the last. It gets the slate Band on the homepage and the slate strip on the CV.
_Avoid_: main employer, current job

**Profile**:
Everything the homepage and the CV say about Simon: contact details, projects, jobs, skills, education, spoken languages. Written in `data.js`; `profile.js` derives the rest, such as which projects are Featured projects and which job is the Main job. Not the CV's "Profil" heading, which holds only the about paragraphs.
_Avoid_: resume data, site data

**CV**:
The downloadable PDF document generated from the shared data, in French.
_Avoid_: resume, résumé, resume page

**Iris**:
The retired purple-to-pink, near-black design language from May 2026. It was dropped because it reads as AI-generated.
_Avoid_: reusing the name for its replacement
