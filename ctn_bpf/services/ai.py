
from django.conf import settings

import os
from groq import Groq

def suggerer_commentaire_tache(nom_tache):
    client = Groq(api_key=settings.GROQ_API_KEY)
    
    prompt = f"""
    En tant qu'expert MEAL, rédige un commentaire de suivi de 2 phrases pour cette tâche :
    Tâche : {nom_tache}.
    Le ton doit être professionnel et constructif.
    """
    
    completion = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        max_tokens=100 # On limite pour avoir un commentaire concis
    )
    return completion.choices[0].message.content.strip()
