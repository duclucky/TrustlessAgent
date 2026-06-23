# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
import json

class Contract(gl.Contract):
    latest_verdict: str
    latest_confidence: int
    latest_consistency: bool
    latest_scale: bool
    latest_reason: str

    def __init__(self):
        self.latest_verdict = "NONE"
        self.latest_confidence = 0
        self.latest_consistency = False
        self.latest_scale = False
        self.latest_reason = ""

    @gl.public.write
    def verify_disaster(self, criteria: str, source_urls: DynArray[str]) -> str:
        if len(source_urls) == 0:
            raise ValueError("UserError: 0 source_urls provided")

        def leader_fn() -> str:
            gathered = []
            for url in source_urls:
                try:
                    page = gl.nondet.web.render(url, mode="text")
                    if page and len(page.strip()) > 0:
                        gathered.append(page)
                except Exception:
                    pass

            if len(gathered) == 0:
                return json.dumps({
                    "verdict": "INSUFFICIENT",
                    "confidence": 0,
                    "cross_source_consistency": False,
                    "scale_meets_threshold": False,
                    "reason": "No usable sources found or all URLs dead"
                })

            evidence = "\n\n---SOURCE---\n\n".join(gathered)
            task = f"""
            You are a disaster-verification juror. Donor criteria: {criteria}.
            Using the independent sources below, decide:
            - Did a REAL disaster matching the criteria actually occur?
            - Do the sources AGREE (cross-consistent) or contradict?
            - Does the scale meet the donor's threshold in the criteria?
            - Any sign of fake, recycled, or exaggerated news?
            Sources:
            {evidence}
            Respond ONLY as JSON: verdict ("CONFIRMED"|"REJECTED"|"INSUFFICIENT"),
            confidence (0-100 int), cross_source_consistency (bool),
            scale_meets_threshold (bool), reason (short string).
            """
            
            return gl.nondet.exec_prompt(task, response_format="json")

        principle = """Two outputs are equivalent ONLY IF they reach the same verdict label
(CONFIRMED/REJECTED/INSUFFICIENT) AND agree on cross_source_consistency.
Wording of 'reason' may differ; the verdict label and consistency flag may NOT."""

        res_str = gl.eq_principle.prompt_comparative(leader_fn, principle=principle)
        
        try:
            data = json.loads(res_str)
            verdict = str(data.get("verdict", "INSUFFICIENT"))
            confidence = int(data.get("confidence", 0))
            consistency = bool(data.get("cross_source_consistency", False))
            scale = bool(data.get("scale_meets_threshold", False))
            reason = str(data.get("reason", "No reason provided"))
            
            if verdict not in ["CONFIRMED", "REJECTED", "INSUFFICIENT"]:
                raise ValueError("Invalid verdict label")
                
        except Exception as e:
            raise ValueError("UserError: exec_prompt returned invalid format or missing keys")

        self.latest_verdict = verdict
        self.latest_confidence = confidence
        self.latest_consistency = consistency
        self.latest_scale = scale
        self.latest_reason = reason

        return verdict

    @gl.public.view
    def get_latest_verdict(self) -> str:
        return self.latest_verdict

    @gl.public.view
    def get_latest_reason(self) -> str:
        return self.latest_reason
