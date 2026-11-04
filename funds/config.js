// Ported from historica-grant-bot/config.py
export default {
  "profile": "Project name: Historica\n    What it does: Historical document extraction using LLMs (large language models),\n    with applications in GIS (Geographic Information Systems) workflows, cultural\n    heritage, and open knowledge communities. We turn historical documents (maps,\n    archives, records) into structured, machine-readable, geographically-located\n    data — including AI-assisted extraction pipelines, temporal/historical map\n    reconstruction, and tools for exploring historical-geographic data.\n    Team: Small self-funded team of 3 people.\n    Legal form: Not yet incorporated. Future direction (open-source nonprofit vs.\n    startup/company) is undecided, so both open-source grants AND startup/SME\n    funding tracks are currently relevant — do not filter out a call just because\n    it expects a registered company or expects commercialization/SaaS, but note\n    in your relevance_note if incorporation or company status seems to be a hard\n    prerequisite to apply.\n    Also looking for: startup programs and in-kind support from large tech companies\n    (cloud/GPU/API credits, accelerators, mentoring, e.g. AWS Activate, NVIDIA Inception,\n    Google for Startups, Microsoft for Startups, etc.). These count as relevant\n    opportunities even though they are not cash grants.\n    Looking for: Grants, open calls, or funding programs in: open-source software\n    development; digital humanities; AI/LLM applications; GIS/geospatial tools;\n    open knowledge / open data; cultural heritage digitization; cultural tourism;\n    creative industries / digital transformation in culture.\n    Typical funding size needed: anything from small grants (a few thousand EUR)\n    up to large EU consortium grants (multi-million EUR), since both early-stage\n    and growth-stage opportunities are relevant right now.\n    Team capacity note: we are a 3-person team and CANNOT lead or join a large\n    multi-partner EU consortium alone without external partners (e.g. universities,\n    museums, archives, cities). Flag clearly any call that structurally requires a\n    multi-organization consortium to apply.",
  "rules": "HARD EXCLUSIONS:\n- Never include fellowships (personal fellowships, residencies, scholarships for individuals).\n- Never include funds/calls about fashion, materials science, or social/humanitarian aid\n  (charity, community help, volunteer programs).\n- Prefer calls focused on history, science, and education (including open-source tools,\n  digital humanities, cultural heritage, AI for research); skip unrelated topics.\n- Never include a call that requires more than 1 participant (consortium, partners, multi-country\n  teams). Only include calls a single applicant can submit. Do not output consortium calls at all.",
  "blocked": [
    "fellowship",
    "fashion",
    "volunteer",
    "volunteering"
  ],
  "sources": [
    {
      "name": "Instrumentl",
      "check_url": "https://www.instrumentl.com/browse-grants/history-grants",
      "notes": "history grants for research, archives, preservation, education, museums, and cultural heritage projects",
      "applicant_type": "either"
    },
    {
      "name": "NLnet",
      "check_url": "https://nlnet.nl/foundation/calls.html",
      "notes": "Open source / internet technology. Multiple thematic funds (NGI Zero, etc). Watch for the general open call being paused/reopened.",
      "applicant_type": "solo"
    },
    {
      "name": "NGI (Next Generation Internet)",
      "check_url": "https://www.ngi.eu/ngi-open-calls/",
      "notes": "Includes NGI Zero, NGI Fediversity, etc.",
      "applicant_type": "solo"
    },
    {
      "name": "Horizon Europe Funding & Tenders Portal",
      "check_url": "https://ec.europa.eu/info/funding-tenders/opportunities/portal/screen/opportunities/calls-for-proposals",
      "notes": "EU research & innovation calls. Filter for digital/AI/cultural heritage topics. Only single-applicant calls (e.g. ERC-style or single-beneficiary); skip anything needing a consortium.",
      "applicant_type": "either"
    },
    {
      "name": "Open Knowledge Foundation",
      "check_url": "https://okfn.org/en/get-involved/",
      "notes": "Open knowledge / open data grants and programs.",
      "applicant_type": "solo"
    },
    {
      "name": "Prototype Fund (Germany)",
      "check_url": "https://prototypefund.de/en/",
      "notes": "Open source software funding, Germany-based but check eligibility.",
      "applicant_type": "solo"
    },
    {
      "name": "Wikimedia Foundation Grants",
      "check_url": "https://meta.wikimedia.org/wiki/Grants:Start",
      "notes": "Aligns with open knowledge angle.",
      "applicant_type": "solo"
    },
    {
      "name": "Sloan Foundation - Technology",
      "check_url": "https://sloan.org/programs/digital-technology",
      "notes": "Open source / digital infrastructure grants for research tools.",
      "applicant_type": "solo"
    },
    {
      "name": "European Cultural Foundation",
      "check_url": "https://culturalfoundation.eu/grants/",
      "notes": "Possible fit if there's a cultural heritage angle to Historica.",
      "applicant_type": "solo"
    },
    {
      "name": "Schmidt Sciences / Patrick J. McGovern Foundation",
      "check_url": "https://schmidtsciences.org/",
      "notes": "AI for public good / research funding.",
      "applicant_type": "solo"
    },
    {
      "name": "EIT Culture & Creativity – Innovation Calls",
      "check_url": "https://eit-culture-creativity.eu/calls/",
      "notes": "Multiple rolling calls in 2026, typically €50k-€500k+. Startups and consortia in cultural/creative innovation. Supports commercialization, does NOT require open-sourcing the core stack.",
      "applicant_type": "either"
    },
    {
      "name": "EIC Accelerator",
      "check_url": "https://eic.ec.europa.eu/eic-funding-opportunities/eic-accelerator_en",
      "notes": "2026 cutoffs active. Up to €2.5M grant + equity. Deep-tech SMEs with scalable innovation. Later-stage target — needs institutional users, SaaS subscriptions, scalable infrastructure.",
      "applicant_type": "solo"
    },
    {
      "name": "Catalyse NEB 2026 – New European Bauhaus Accelerator",
      "check_url": "https://eit-cs.europa.eu/community/new-european-bauhaus",
      "notes": "2026 applications closed Jan 2026, likely annual recurrence — track for 2027. Accelerator + ecosystem access. Impact startups combining culture, sustainability, innovation, design. Good fit if Historica expands toward public cultural experiences / city-scale visualization.",
      "applicant_type": "either"
    },
    {
      "name": "Creative Europe Calls",
      "check_url": "https://culture.ec.europa.eu/creative-europe/calls-for-proposals",
      "notes": "Multiple active calls through 2026, €200k-€2M+ depending on call. Cross-border cultural/creative collaboration. Strong for public-facing historical storytelling, educational platforms, exhibitions, tourism layers, documentary integrations.",
      "applicant_type": "either"
    },
    {
      "name": "Cascade Funding",
      "check_url": "https://cascadefunding.eu/open-calls/",
      "notes": "Aggregator of EU cascade-funding open calls. Only domains: culture and heritage; social sciences & humanities; education and training. Skip any call needing 2+ participants.",
      "applicant_type": "solo"
    },
    {
      "name": "UNESCO Prize - ICT in Education",
      "check_url": "https://www.unesco.org/en/prizes/ict-education",
      "notes": "Prize, not a grant. We only need to know when the call for nominations is open (and its deadline).",
      "applicant_type": "solo"
    },
    {
      "name": "AWS Activate (Startup Credits)",
      "check_url": "https://aws.amazon.com/startups/credits/",
      "notes": "Startup program: AWS cloud credits. Note eligibility (e.g. unincorporated teams, funding stage, website requirements) and credit amount.",
      "applicant_type": "solo",
      "single_program": true
    },
    {
      "name": "NVIDIA Inception Program",
      "check_url": "https://www.nvidia.com/en-us/startups/",
      "notes": "Startup program for AI companies: GPU/cloud credits, discounts, technical support, VC exposure. Check eligibility for unincorporated teams.",
      "applicant_type": "solo",
      "single_program": true
    },
    {
      "name": "Google for Startups Cloud Program",
      "check_url": "https://cloud.google.com/startup",
      "notes": "Startup program: Google Cloud credits, plus Gemini/AI credits. Check stage and eligibility requirements.",
      "applicant_type": "solo",
      "single_program": true
    },
    {
      "name": "Microsoft for Startups Founders Hub",
      "check_url": "https://www.microsoft.com/en-us/startups",
      "notes": "Startup program: Azure and OpenAI credits, mentoring, tools. Check eligibility for pre-incorporation teams.",
      "applicant_type": "solo",
      "single_program": true
    }
  ],
  "queries": [
    "open call cascade funding culture heritage social sciences humanities education training single applicant 2026",
    "open call grant open source GIS mapping AI 2026",
    "funding open source digital humanities historical documents 2026",
    "grant open data cultural heritage AI extraction 2026",
    "NGI open call open source 2026",
    "startup program credits AI startups cloud GPU 2026 (AWS, NVIDIA, Google, Microsoft, Meta, OpenAI, Anthropic)",
    "big tech startup accelerator free credits AI GIS cultural heritage 2026"
  ]
};
