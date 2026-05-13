"""
resources.py
------------
Curated library of real, verified learning resources.
The roadmap LLM selects from this list — it never invents URLs.
Each resource has tags used for relevance-based filtering.
"""

from __future__ import annotations


RESOURCE_LIBRARY: list[dict] = [
    # ── Python ─────────────────────────────────────────────────────────────
    {"name": "Automate the Boring Stuff with Python",
     "url": "https://automatetheboringstuff.com",
     "type": "book", "is_free": True, "estimated_hours": 20,
     "tags": ["python", "scripting", "automation", "beginner"]},

    {"name": "CS50P: Python Programming — Harvard (free)",
     "url": "https://cs50.harvard.edu/python",
     "type": "course", "is_free": True, "estimated_hours": 30,
     "tags": ["python", "beginner", "programming fundamentals"]},

    {"name": "Python for Everybody Specialization — Coursera (U. Michigan)",
     "url": "https://www.coursera.org/specializations/python",
     "type": "course", "is_free": False, "estimated_hours": 40,
     "tags": ["python", "beginner", "data"]},

    {"name": "Intermediate Python — freeCodeCamp YouTube",
     "url": "https://www.youtube.com/watch?v=HGOBQPFzWKo",
     "type": "video", "is_free": True, "estimated_hours": 6,
     "tags": ["python", "intermediate", "oop", "decorators"]},

    # ── FastAPI / Backend ────────────────────────────────────────────────
    {"name": "FastAPI Full Course — freeCodeCamp YouTube",
     "url": "https://www.youtube.com/watch?v=0sOvCWFmrtA",
     "type": "video", "is_free": True, "estimated_hours": 6,
     "tags": ["fastapi", "python", "backend", "api", "rest"]},

    {"name": "FastAPI Crash Course — Traversy Media YouTube",
     "url": "https://www.youtube.com/watch?v=SORiTsvnU28",
     "type": "video", "is_free": True, "estimated_hours": 2,
     "tags": ["fastapi", "python", "api"]},

    {"name": "Python Django Full Course — Traversy Media YouTube",
     "url": "https://www.youtube.com/watch?v=PtQiiknWUcI",
     "type": "video", "is_free": True, "estimated_hours": 5,
     "tags": ["django", "python", "backend", "web", "rest"]},

    {"name": "Python REST APIs With Flask — Real Python",
     "url": "https://realpython.com/flask-connexion-rest-api",
     "type": "course", "is_free": True, "estimated_hours": 4,
     "tags": ["flask", "python", "api", "rest"]},

    # ── Node.js / Express ────────────────────────────────────────────────
    {"name": "The Complete Node.js Developer Course — Udemy (Andrew Mead)",
     "url": "https://www.udemy.com/course/the-complete-nodejs-developer-course-2",
     "type": "course", "is_free": False, "estimated_hours": 35,
     "tags": ["node", "nodejs", "express", "backend", "javascript", "mongodb", "mern"]},

    {"name": "Node.js Crash Course — Traversy Media YouTube",
     "url": "https://www.youtube.com/watch?v=fBNz5xF-Kx4",
     "type": "video", "is_free": True, "estimated_hours": 2,
     "tags": ["node", "nodejs", "javascript", "backend"]},

    {"name": "Node.js & Express.js Full Course — freeCodeCamp YouTube",
     "url": "https://www.youtube.com/watch?v=Oe421EPjeBE",
     "type": "video", "is_free": True, "estimated_hours": 8,
     "tags": ["node", "nodejs", "express", "backend", "javascript"]},

    # ── React / Frontend ─────────────────────────────────────────────────
    {"name": "Full Stack Open 2024 — University of Helsinki (free)",
     "url": "https://fullstackopen.com/en",
     "type": "course", "is_free": True, "estimated_hours": 60,
     "tags": ["react", "node", "javascript", "fullstack", "typescript", "graphql", "testing", "mern"]},

    {"name": "React — The Complete Guide — Udemy (Maximilian Schwarzmüller)",
     "url": "https://www.udemy.com/course/react-the-complete-guide-incl-redux",
     "type": "course", "is_free": False, "estimated_hours": 60,
     "tags": ["react", "redux", "javascript", "frontend", "typescript", "hooks"]},

    {"name": "React JS Crash Course — Traversy Media YouTube",
     "url": "https://www.youtube.com/watch?v=w7ejDZ8SWv8",
     "type": "video", "is_free": True, "estimated_hours": 2,
     "tags": ["react", "javascript", "frontend"]},

    {"name": "React Hook Form + Zod — Cosden Solutions YouTube",
     "url": "https://www.youtube.com/watch?v=cc_xmawJ8Kg",
     "type": "video", "is_free": True, "estimated_hours": 1,
     "tags": ["react", "forms", "validation", "typescript", "frontend"]},

    # ── TypeScript ───────────────────────────────────────────────────────
    {"name": "Understanding TypeScript — Udemy (Maximilian Schwarzmüller)",
     "url": "https://www.udemy.com/course/understanding-typescript",
     "type": "course", "is_free": False, "estimated_hours": 22,
     "tags": ["typescript", "javascript", "frontend", "backend"]},

    {"name": "TypeScript Full Course — freeCodeCamp YouTube",
     "url": "https://www.youtube.com/watch?v=30LWjhZzg50",
     "type": "video", "is_free": True, "estimated_hours": 4,
     "tags": ["typescript", "javascript"]},

    # ── Machine Learning / AI ────────────────────────────────────────────
    {"name": "Machine Learning Specialization — Andrew Ng Coursera",
     "url": "https://www.coursera.org/specializations/machine-learning-introduction",
     "type": "course", "is_free": False, "estimated_hours": 60,
     "tags": ["machine learning", "ml", "ai", "data science", "scikit-learn", "regression", "classification"]},

    {"name": "Practical Deep Learning for Coders — Fast.ai (free)",
     "url": "https://course.fast.ai",
     "type": "course", "is_free": True, "estimated_hours": 30,
     "tags": ["deep learning", "pytorch", "ai", "ml", "computer vision", "nlp", "tabular data"]},

    {"name": "Deep Learning Specialization — DeepLearning.AI Coursera",
     "url": "https://www.coursera.org/specializations/deep-learning",
     "type": "course", "is_free": False, "estimated_hours": 80,
     "tags": ["deep learning", "neural networks", "tensorflow", "ai", "cnn", "rnn"]},

    {"name": "Machine Learning with Python — freeCodeCamp YouTube",
     "url": "https://www.youtube.com/watch?v=i_LwzRVP7bg",
     "type": "video", "is_free": True, "estimated_hours": 10,
     "tags": ["machine learning", "python", "scikit-learn", "ml", "classification"]},

    {"name": "Kaggle Learn — free interactive ML, pandas, SQL, DL",
     "url": "https://www.kaggle.com/learn",
     "type": "course", "is_free": True, "estimated_hours": 20,
     "tags": ["machine learning", "pandas", "sql", "data science", "python", "feature engineering"]},

    # ── LLMs / Generative AI ─────────────────────────────────────────────
    {"name": "Neural Networks: Zero to Hero — Andrej Karpathy YouTube",
     "url": "https://www.youtube.com/playlist?list=PLAqhIrjkxbuWI23v9cThsA9GvCAUhRvKZ",
     "type": "video", "is_free": True, "estimated_hours": 15,
     "tags": ["llm", "neural networks", "deep learning", "transformers", "nlp", "generative ai", "gpt"]},

    {"name": "LangChain & LLM Apps Full Course — freeCodeCamp YouTube",
     "url": "https://www.youtube.com/watch?v=lG7Uxts9SXs",
     "type": "video", "is_free": True, "estimated_hours": 5,
     "tags": ["langchain", "llm", "generative ai", "rag", "ai", "python"]},

    {"name": "Generative AI with LLMs — DeepLearning.AI Coursera",
     "url": "https://www.coursera.org/learn/generative-ai-with-llms",
     "type": "course", "is_free": False, "estimated_hours": 16,
     "tags": ["llm", "generative ai", "transformers", "fine-tuning", "rlhf", "prompt engineering"]},

    {"name": "NLP Course — Hugging Face (free, interactive)",
     "url": "https://huggingface.co/learn/nlp-course",
     "type": "course", "is_free": True, "estimated_hours": 25,
     "tags": ["nlp", "transformers", "hugging face", "llm", "bert", "fine-tuning", "tokenization"]},

    {"name": "LLM Twin Course — Decoding ML GitHub (free)",
     "url": "https://github.com/decodingml/llm-twin-course",
     "type": "course", "is_free": True, "estimated_hours": 20,
     "tags": ["llm", "rag", "mlops", "vector database", "generative ai", "production"]},

    # ── MLOps ────────────────────────────────────────────────────────────
    {"name": "MLOps Specialization — DeepLearning.AI Coursera",
     "url": "https://www.coursera.org/specializations/machine-learning-engineering-for-production-mlops",
     "type": "course", "is_free": False, "estimated_hours": 16,
     "tags": ["mlops", "ml", "production", "deployment", "mlflow", "monitoring", "pipelines"]},

    {"name": "MLOps Zoomcamp — DataTalks.Club (free GitHub repo)",
     "url": "https://github.com/DataTalks-Club/mlops-zoomcamp",
     "type": "course", "is_free": True, "estimated_hours": 40,
     "tags": ["mlops", "ml", "airflow", "mlflow", "production", "deployment", "prefect"]},

    {"name": "MLflow Tutorial — freeCodeCamp YouTube",
     "url": "https://www.youtube.com/watch?v=qdcHHrsXA48",
     "type": "video", "is_free": True, "estimated_hours": 3,
     "tags": ["mlflow", "mlops", "experiment tracking", "ml"]},

    # ── Docker / Kubernetes ──────────────────────────────────────────────
    {"name": "Docker Tutorial for Beginners — TechWorld with Nana YouTube",
     "url": "https://www.youtube.com/watch?v=3c-iBn73dDE",
     "type": "video", "is_free": True, "estimated_hours": 3,
     "tags": ["docker", "containers", "devops", "deployment"]},

    {"name": "Kubernetes Tutorial for Beginners — TechWorld with Nana YouTube",
     "url": "https://www.youtube.com/watch?v=X48VuDVv0do",
     "type": "video", "is_free": True, "estimated_hours": 4,
     "tags": ["kubernetes", "k8s", "containers", "devops", "orchestration", "deployment"]},

    {"name": "Docker & Kubernetes: The Practical Guide — Udemy (Maximilian Schwarzmüller)",
     "url": "https://www.udemy.com/course/docker-kubernetes-the-practical-guide",
     "type": "course", "is_free": False, "estimated_hours": 24,
     "tags": ["docker", "kubernetes", "devops", "containers", "deployment"]},

    {"name": "Introduction to Kubernetes — Linux Foundation edX (free)",
     "url": "https://www.edx.org/learn/kubernetes/the-linux-foundation-introduction-to-kubernetes",
     "type": "course", "is_free": True, "estimated_hours": 20,
     "tags": ["kubernetes", "k8s", "devops", "cloud native"]},

    # ── CI/CD / DevOps ───────────────────────────────────────────────────
    {"name": "GitHub Actions Tutorial — TechWorld with Nana YouTube",
     "url": "https://www.youtube.com/watch?v=R8_veQiYBjI",
     "type": "video", "is_free": True, "estimated_hours": 2,
     "tags": ["github actions", "ci/cd", "devops", "automation"]},

    {"name": "DevOps Bootcamp — TechWorld with Nana YouTube Playlist",
     "url": "https://www.youtube.com/playlist?list=PLy7NrYWoggjwV7qC4kmgbgtFBsqkrsefG",
     "type": "video", "is_free": True, "estimated_hours": 15,
     "tags": ["devops", "ci/cd", "linux", "jenkins", "terraform", "ansible"]},

    {"name": "Terraform Course for Beginners — TechWorld with Nana YouTube",
     "url": "https://www.youtube.com/watch?v=7xngnjfIlK4",
     "type": "video", "is_free": True, "estimated_hours": 3,
     "tags": ["terraform", "iac", "devops", "aws", "cloud", "infrastructure"]},

    # ── AWS / Cloud ──────────────────────────────────────────────────────
    {"name": "Ultimate AWS Certified Solutions Architect — Udemy (Stephane Maarek)",
     "url": "https://www.udemy.com/course/aws-certified-solutions-architect-associate-saa-c03",
     "type": "course", "is_free": False, "estimated_hours": 27,
     "tags": ["aws", "cloud", "architecture", "devops", "s3", "ec2", "rds", "lambda"]},

    {"name": "AWS Cloud Practitioner — freeCodeCamp YouTube (14-hour course)",
     "url": "https://www.youtube.com/watch?v=NhDYbskXRgc",
     "type": "video", "is_free": True, "estimated_hours": 14,
     "tags": ["aws", "cloud", "beginner"]},

    {"name": "Google Cloud Professional Data Engineer — Coursera",
     "url": "https://www.coursera.org/professional-certificates/gcp-data-engineering",
     "type": "course", "is_free": False, "estimated_hours": 50,
     "tags": ["gcp", "google cloud", "data engineering", "bigquery", "cloud", "dataflow"]},

    # ── System Design / Architecture ─────────────────────────────────────
    {"name": "Designing Data-Intensive Applications — Martin Kleppmann",
     "url": "https://dataintensive.net",
     "type": "book", "is_free": False, "estimated_hours": 35,
     "tags": ["system design", "distributed systems", "databases", "architecture", "consistency", "replication"]},

    {"name": "System Design Interview Vol. 2 — Alex Xu",
     "url": "https://www.amazon.com/dp/1736049119",
     "type": "book", "is_free": False, "estimated_hours": 20,
     "tags": ["system design", "architecture", "interview", "scalability"]},

    {"name": "System Design Playlist — ByteByteGo YouTube",
     "url": "https://www.youtube.com/@ByteByteGo",
     "type": "video", "is_free": True, "estimated_hours": 15,
     "tags": ["system design", "architecture", "distributed systems", "interview", "scalability", "microservices"]},

    {"name": "System Design Primer — GitHub (donnemartin, 260k stars)",
     "url": "https://github.com/donnemartin/system-design-primer",
     "type": "book", "is_free": True, "estimated_hours": 20,
     "tags": ["system design", "architecture", "distributed systems", "scalability"]},

    # ── Databases ────────────────────────────────────────────────────────
    {"name": "The Complete SQL Bootcamp — Udemy (Jose Portilla)",
     "url": "https://www.udemy.com/course/the-complete-sql-bootcamp",
     "type": "course", "is_free": False, "estimated_hours": 9,
     "tags": ["sql", "postgresql", "databases", "data analysis"]},

    {"name": "MongoDB Crash Course — Traversy Media YouTube",
     "url": "https://www.youtube.com/watch?v=-56x56UppqQ",
     "type": "video", "is_free": True, "estimated_hours": 2,
     "tags": ["mongodb", "nosql", "databases", "mern"]},

    {"name": "Redis Crash Course — Traversy Media YouTube",
     "url": "https://www.youtube.com/watch?v=jgpVdJB2sKQ",
     "type": "video", "is_free": True, "estimated_hours": 1,
     "tags": ["redis", "caching", "databases", "backend", "pub/sub"]},

    {"name": "CMU Database Systems — Andy Pavlo YouTube (free university course)",
     "url": "https://www.youtube.com/playlist?list=PLSE8ODhjZXjbj8BMuIrRcacnQh20hmY9g",
     "type": "video", "is_free": True, "estimated_hours": 30,
     "tags": ["databases", "postgresql", "sql", "internals", "advanced", "transactions", "indexing"]},

    # ── Data Engineering ─────────────────────────────────────────────────
    {"name": "Data Engineering Zoomcamp — DataTalks.Club (free GitHub repo)",
     "url": "https://github.com/DataTalks-Club/data-engineering-zoomcamp",
     "type": "course", "is_free": True, "estimated_hours": 60,
     "tags": ["data engineering", "airflow", "spark", "bigquery", "dbt", "kafka", "prefect"]},

    {"name": "Apache Spark with Python — Udemy (Frank Kane)",
     "url": "https://www.udemy.com/course/taming-big-data-with-apache-spark-hands-on",
     "type": "course", "is_free": False, "estimated_hours": 15,
     "tags": ["spark", "big data", "python", "data engineering", "pyspark"]},

    {"name": "Apache Kafka Crash Course — TechWorld with Nana YouTube",
     "url": "https://www.youtube.com/watch?v=uvb00oaa3k8",
     "type": "video", "is_free": True, "estimated_hours": 1,
     "tags": ["kafka", "message queue", "data engineering", "streaming", "event driven"]},

    # ── Algorithms / CS Fundamentals ─────────────────────────────────────
    {"name": "Algorithms & Data Structures Course — NeetCode YouTube",
     "url": "https://www.youtube.com/watch?v=cbB3ewNkO_E",
     "type": "video", "is_free": True, "estimated_hours": 8,
     "tags": ["algorithms", "data structures", "leetcode", "interview prep", "python"]},

    {"name": "Introduction to Algorithms — MIT OpenCourseWare (free)",
     "url": "https://ocw.mit.edu/courses/6-006-introduction-to-algorithms-spring-2020",
     "type": "course", "is_free": True, "estimated_hours": 40,
     "tags": ["algorithms", "data structures", "computer science", "advanced"]},

    {"name": "The Missing Semester of Your CS Education — MIT (free)",
     "url": "https://missing.csail.mit.edu",
     "type": "course", "is_free": True, "estimated_hours": 12,
     "tags": ["linux", "shell", "bash", "git", "vim", "devops", "tools"]},

    # ── Microservices ────────────────────────────────────────────────────
    {"name": "Microservices with Node & React — Udemy (Stephen Grider)",
     "url": "https://www.udemy.com/course/microservices-with-node-js-and-react",
     "type": "course", "is_free": False, "estimated_hours": 54,
     "tags": ["microservices", "node", "react", "kubernetes", "typescript", "docker", "event driven"]},

    {"name": "Microservices Tutorial — TechWorld with Nana YouTube",
     "url": "https://www.youtube.com/watch?v=rv4LlmLmVWk",
     "type": "video", "is_free": True, "estimated_hours": 2,
     "tags": ["microservices", "architecture", "docker", "kubernetes", "api gateway"]},

    # ── Security ─────────────────────────────────────────────────────────
    {"name": "Web Security Academy — PortSwigger (free, hands-on labs)",
     "url": "https://portswigger.net/web-security",
     "type": "course", "is_free": True, "estimated_hours": 30,
     "tags": ["security", "web security", "owasp", "xss", "sql injection", "pentesting"]},

    # ── Software Engineering Principles ──────────────────────────────────
    {"name": "The Pragmatic Programmer — Hunt & Thomas",
     "url": "https://pragprog.com/titles/tpp20/the-pragmatic-programmer-20th-anniversary-edition",
     "type": "book", "is_free": False, "estimated_hours": 15,
     "tags": ["software engineering", "best practices", "architecture", "clean code", "career"]},

    {"name": "Clean Code — Robert C. Martin",
     "url": "https://www.amazon.com/Clean-Code-Handbook-Software-Craftsmanship/dp/0132350882",
     "type": "book", "is_free": False, "estimated_hours": 12,
     "tags": ["clean code", "software engineering", "refactoring", "best practices", "oop"]},

    # ── GraphQL / APIs ───────────────────────────────────────────────────
    {"name": "GraphQL Crash Course — Traversy Media YouTube",
     "url": "https://www.youtube.com/watch?v=BcLNfwF04Kw",
     "type": "video", "is_free": True, "estimated_hours": 2,
     "tags": ["graphql", "api", "backend", "javascript"]},

    # ── Go ───────────────────────────────────────────────────────────────
    {"name": "Golang Tutorial for Beginners — freeCodeCamp YouTube",
     "url": "https://www.youtube.com/watch?v=un6ZyFkqFKo",
     "type": "video", "is_free": True, "estimated_hours": 7,
     "tags": ["go", "golang", "backend", "systems"]},

    # ── Testing ──────────────────────────────────────────────────────────
    {"name": "Python Testing with Pytest — Brian Okken",
     "url": "https://pragprog.com/titles/bopytest2/python-testing-with-pytest-second-edition",
     "type": "book", "is_free": False, "estimated_hours": 10,
     "tags": ["testing", "pytest", "python", "tdd", "unit testing"]},
]


def select_resources(skills: list[str], target_role: str, max_results: int = 25) -> list[dict]:
    """
    Returns a deduplicated subset of RESOURCE_LIBRARY relevant to the given
    skills and target_role. Uses tag overlap scoring — no external deps.
    """
    query_tokens = set()
    for s in skills:
        query_tokens.update(s.lower().split())
    for word in target_role.lower().split():
        query_tokens.add(word)

    # Remove very generic stop tokens that would match everything
    stop = {"the", "and", "or", "with", "for", "a", "an", "in", "of", "to",
            "engineer", "engineering", "developer", "development", "senior",
            "junior", "mid", "level", "lead", "staff", "principal"}
    query_tokens -= stop

    scored = []
    for resource in RESOURCE_LIBRARY:
        tag_tokens = set()
        for tag in resource["tags"]:
            tag_tokens.update(tag.lower().split())
        overlap = len(query_tokens & tag_tokens)
        if overlap > 0:
            scored.append((overlap, resource))

    scored.sort(key=lambda x: x[0], reverse=True)
    seen = set()
    results = []
    for _, r in scored:
        key = r["url"]
        if key not in seen:
            seen.add(key)
            results.append(r)
        if len(results) >= max_results:
            break

    # Always include at least some general engineering resources if few matches
    if len(results) < 8:
        fallback_tags = {"python", "backend", "software engineering", "system design"}
        for r in RESOURCE_LIBRARY:
            if any(t in fallback_tags for t in r["tags"]) and r["url"] not in seen:
                results.append(r)
                seen.add(r["url"])
            if len(results) >= max_results:
                break

    return results


def format_for_prompt(resources: list[dict]) -> str:
    """Formats the resource list as a readable block to inject into the prompt."""
    lines = []
    for r in resources:
        free_label = "free" if r["is_free"] else "paid"
        lines.append(
            f'  - [{r["type"].upper()}] {r["name"]} | {r["url"]} | {free_label} | ~{r["estimated_hours"]}h'
        )
    return "\n".join(lines)
