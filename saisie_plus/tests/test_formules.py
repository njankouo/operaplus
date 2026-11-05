from django.test import SimpleTestCase

from saisie_plus.formules import FormuleInvalide, dependances, developper, evaluer, verifier

BASE = {9: '$1$ / $2$ * 100', 10: '$3$ / $4$ * 100', 11: '( #9# + #10# ) / 2', 12: '#11# - #9#', 13: '', 20: '#21#', 21: '#20#'}
charge = lambda ids: {i: BASE[i] for i in ids if i in BASE}


class FormulesTests(SimpleTestCase):
    def test_developpe_en_cascade(self):
        self.assertEqual(developper('#12#', charge), '((( ($1$ / $2$ * 100) + ($3$ / $4$ * 100) ) / 2) - ($1$ / $2$ * 100))')
        self.assertEqual(dependances('#11# + $7$', charge), [1, 2, 3, 4, 7])

    def test_calcul(self):
        v = {1: 30, 2: 60, 3: 45, 4: 50}                 # 50 % et 90 %
        self.assertAlmostEqual(evaluer(developper('#11#', charge), v), 70.0)
        self.assertAlmostEqual(evaluer(developper('#12#', charge), v), 20.0)
        with self.assertRaises(ZeroDivisionError):
            evaluer(developper('#9#', charge), {1: 3})

    def test_erreurs(self):
        self.assertIn('Boucle', verifier('#20#', charger=charge)[0])
        self.assertIn('lui-même', verifier('#5# + 1', indicateur_id=5, charger=charge)[0])
        self.assertIn('Boucle', verifier('#11#', indicateur_id=9, charger=lambda ids: {**charge(ids), **({9: '#11#'} if 9 in ids else {})})[0])
        self.assertIn('saisie manuelle', verifier('#13# * 2', charger=charge)[0])
        self.assertIn('introuvable', verifier('#99#', charger=charge)[0])
        self.assertIn('mal écrite', verifier('( $1$ + ', charger=charge)[0])
        self.assertEqual(verifier('( #9# + #10# ) / 2', charger=charge), [])

    def test_pas_de_code(self):
        with self.assertRaises(FormuleInvalide):
            evaluer('__import__("os")', {})
