"""
DSA Topic Whitelist & Verification Engine
Strictly enforces candidate portfolio DSA boundaries.
Rejects generated assessment questions targeting topics not claimed in the candidate's portfolio.
Role: QA, Architecture & Security Lead
Project: Portfolio-Driven Adaptive Coding & Technical Assessment Platform
"""

import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Canonical Taxonomy of DSA Topics
CANONICAL_DSA_TOPICS = {
    "arrays": "Arrays",
    "array": "Arrays",
    "strings": "Strings",
    "string": "Strings",
    "linked lists": "Linked Lists",
    "linked list": "Linked Lists",
    "stacks": "Stacks",
    "stack": "Stacks",
    "queues": "Queues",
    "queue": "Queues",
    "hash tables": "Hash Tables",
    "hash table": "Hash Tables",
    "hash maps": "Hash Tables",
    "hash map": "Hash Tables",
    "hashing": "Hash Tables",
    "trees": "Trees",
    "tree": "Trees",
    "binary tree": "Trees",
    "binary search tree": "Trees",
    "bst": "Trees",
    "heaps": "Heaps",
    "heap": "Heaps",
    "priority queue": "Heaps",
    "graphs": "Graphs",
    "graph": "Graphs",
    "dynamic programming": "Dynamic Programming",
    "dp": "Dynamic Programming",
    "greedy": "Greedy Algorithms",
    "greedy algorithms": "Greedy Algorithms",
    "backtracking": "Backtracking",
    "bit manipulation": "Bit Manipulation",
    "tries": "Tries",
    "trie": "Tries",
    "sliding window": "Sliding Window",
    "two pointers": "Two Pointers",
    "binary search": "Binary Search",
    "sorting": "Sorting",
    "divide and conquer": "Divide and Conquer",
}

# Advanced topics that must NEVER be served unless explicitly claimed
STRICT_TOPICS = {
    "Graphs": ["graph", "graphs", "bfs", "dfs", "dijkstra", "topological sort", "adjacency"],
    "Trees": ["tree", "trees", "binary tree", "bst", "trie", "inorder", "preorder", "postorder"],
    "Dynamic Programming": ["dynamic programming", "memoization", "knapsack", "subsequence", "tabulation"],
    "Tries": ["trie", "tries", "prefix tree"],
    "Heaps": ["heap", "heaps", "priority queue", "heapq"],
    "Backtracking": ["backtracking", "n-queens", "permutations", "subsets"],
    "Sliding Window": ["sliding window"],
}


def normalize_dsa_topic(raw_topic: str) -> Optional[str]:
    """Normalizes arbitrary free-text topic string into canonical taxonomy tag."""
    if not raw_topic:
        return None
    cleaned = raw_topic.strip().lower()
    if cleaned in CANONICAL_DSA_TOPICS:
        return CANONICAL_DSA_TOPICS[cleaned]
    for key, canonical in CANONICAL_DSA_TOPICS.items():
        if key in cleaned:
            return canonical
    return None


def extract_claimed_dsa_topics(portfolio: Dict[str, Any]) -> List[str]:
    """
    Extracts canonical claimed DSA topics from portfolio JSON.
    Inspects dsa_topics_solved, dsa_topics, dsaTopics, and parsed_skills.
    """
    raw_topics = (
        portfolio.get("dsa_topics_solved")
        or portfolio.get("dsa_topics")
        or portfolio.get("dsaTopics")
        or portfolio.get("claimed_dsa_topics")
        or []
    )
    if isinstance(raw_topics, str):
        raw_topics = [t.strip() for t in raw_topics.split(",") if t.strip()]

    canonical_set: Set[str] = set()
    for t in raw_topics:
        norm = normalize_dsa_topic(str(t))
        if norm:
            canonical_set.add(norm)

    # Check skills list and technical_skills for any DSA topics
    skills = (
        portfolio.get("skills")
        or portfolio.get("parsed_skills")
        or portfolio.get("technical_skills")
        or []
    )
    if isinstance(skills, list):
        for s in skills:
            if isinstance(s, dict):
                cat = str(s.get("category", "")).lower()
                name = str(s.get("name", ""))
                if "dsa" in cat or "algorithm" in cat or "skill" in cat or not cat:
                    norm = normalize_dsa_topic(name)
                    if norm:
                        canonical_set.add(norm)
            elif isinstance(s, str):
                norm = normalize_dsa_topic(s)
                if norm:
                    canonical_set.add(norm)
    
    # Also check technical_skills specifically if present
    tech_skills = portfolio.get("technical_skills") or []
    if isinstance(tech_skills, list):
        for ts in tech_skills:
            if isinstance(ts, str):
                norm = normalize_dsa_topic(ts)
                if norm:
                    canonical_set.add(norm)

    return sorted(list(canonical_set))


def detect_question_dsa_topics(
    title: str,
    description: str,
    topic: str,
    domain: str,
) -> Set[str]:
    """Detects which DSA topics are present in a question specification."""
    detected: Set[str] = set()
    combined_text = f"{title} {description} {topic} {domain}".lower()

    for canonical_name, keywords in STRICT_TOPICS.items():
        for kw in keywords:
            pattern = r"\b" + re.escape(kw) + r"\b"
            if re.search(pattern, combined_text, re.IGNORECASE):
                detected.add(canonical_name)
                break

    # Check canonical keywords
    for key, canonical in CANONICAL_DSA_TOPICS.items():
        pattern = r"\b" + re.escape(key) + r"\b"
        if re.search(pattern, combined_text, re.IGNORECASE):
            detected.add(canonical)

    return detected


def validate_question_dsa_whitelist(
    title: Any = None,
    description: Any = None,
    topic: Optional[str] = None,
    domain: Optional[str] = None,
    claimed_dsa_topics: Optional[List[str]] = None,
    **kwargs,
) -> Tuple[bool, List[str]]:
    """
    Zero-trust validator:
    Confirms that all detected DSA topics in a question belong to the candidate's claimed whitelist.
    Supports being called either as:
    1. validate_question_dsa_whitelist(question_obj, claimed_dsa_topics)
    2. validate_question_dsa_whitelist(title=..., description=..., topic=..., domain=..., claimed_dsa_topics=...)
    Returns (is_valid, list_of_violations).
    """
    if not isinstance(title, str) and hasattr(title, "title"):
        q = title
        title_str = str(getattr(q, "title", ""))
        desc_str = str(getattr(q, "description", ""))
        topic_str = str(getattr(q, "target_skill", None) or getattr(q, "topic", "") or getattr(q, "category", "") or "")
        domain_str = str(getattr(q, "domain", "") or "")
        claimed_list = description or claimed_dsa_topics or []
    else:
        title_str = str(title or "")
        desc_str = str(description or "")
        topic_str = str(topic or "")
        domain_str = str(domain or "")
        claimed_list = claimed_dsa_topics or []

    if not claimed_list:
        # If candidate specified no specific topics, allow foundational linear structures (Arrays, Strings)
        claimed_set = {"Arrays", "Strings"}
    else:
        claimed_set = {normalize_dsa_topic(t) for t in claimed_list if t}

    detected_topics = detect_question_dsa_topics(title_str, desc_str, topic_str, domain_str)
    
    # Also explicitly add the target_skill or topic itself if canonical
    norm_topic = normalize_dsa_topic(topic_str)
    if norm_topic:
        detected_topics.add(norm_topic)

    violations: List[str] = []

    for detected in detected_topics:
        if detected not in claimed_set:
            violations.append(
                f"Question introduces un-claimed topic '{detected}'. "
                f"Candidate only claimed: {sorted(list(claimed_set))}."
            )

    return (len(violations) == 0, violations)
