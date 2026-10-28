from django.core.management.base import BaseCommand
from ctn_bpf.models import Devise

CURRENCIES = [
    {"code": "USD", "symbole": "$", "nom": "Dollar américain"},
    {"code": "EUR", "symbole": "€", "nom": "Euro"},
    {"code": "GBP", "symbole": "£", "nom": "Livre sterling"},
    {"code": "JPY", "symbole": "¥", "nom": "Yen japonais"},
    {"code": "XAF", "symbole": "FCFA", "nom": "Franc CFA BEAC"},
    {"code": "XOF", "symbole": "FCFA", "nom": "Franc CFA UEMOA"},
    {"code": "CNY", "symbole": "¥", "nom": "Yuan chinois"},
    {"code": "INR", "symbole": "₹", "nom": "Roupie indienne"},
    {"code": "AUD", "symbole": "$", "nom": "Dollar australien"},
    {"code": "CAD", "symbole": "$", "nom": "Dollar canadien"},
    {"code": "CHF", "symbole": "CHF", "nom": "Franc suisse"},
    {"code": "BRL", "symbole": "R$", "nom": "Real brésilien"},
    {"code": "ZAR", "symbole": "R", "nom": "Rand sud-africain"},
    
]

class Command(BaseCommand):
    help = "Charge la liste complète des devises en base"

    def handle(self, *args, **kwargs):
        for c in CURRENCIES:
            Devise.objects.get_or_create(
                code=c["code"],
                defaults={
                    "symbole": c["symbole"],
                    "nom": c["nom"]
                    
                }
            )
        self.stdout.write(self.style.SUCCESS("Devises chargées avec succès"))
