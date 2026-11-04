import unittest
from datetime import date
from valeurs import normaliser as N, ValeurInvalide as E

class T(unittest.TestCase):
    def test_nombres(self):
        self.assertEqual(N('Number', 'num', '12,5')['m_value'], 12.5)
        self.assertEqual(N('Number', '', '12 500')['m_value'], 12500)
        self.assertEqual(N('Number', 'money', '150 000 FCFA')['m_value'], 150000)
        self.assertEqual(N('Number', 'pct', '45,5 %')['m_value'], 45.5)
        for t, v in [('int', '4,5'), ('age', '130'), ('pct', '101'), ('money', '-3'), ('num', 'abc')]:
            with self.assertRaises(E): N('Number', t, v)
    def test_choix(self):
        self.assertEqual(N('Number', 'yesno', 'Oui')['m_value'], 1.0)
        self.assertEqual(N('Number', 'yesno', '0')['m_value'], 0.0)
        self.assertEqual(N('Number', 'choice:1=F;2=H', '2')['m_value'], 2)
        with self.assertRaises(E): N('Number', 'choice:1=F;2=H', '3')
        with self.assertRaises(E): N('Number', 'scale', '6')
    def test_na(self):
        r = N('Number', 'num', '0', na=True)
        self.assertTrue(r['est_na']); self.assertIsNone(r['m_value'])
    def test_texte(self):
        self.assertEqual(N('Text', 'tel', '677 12 34 56')['texte_element'], '+237677123456')
        self.assertEqual(N('Text', 'tel', '00237 6 77 12 34 56')['texte_element'], '+237677123456')
        self.assertEqual(N('Text', 'email', ' Ana@MEAL.org ')['texte_element'], 'ana@meal.org')
        g = N('Text', 'gps', '4.05123, 9.76785')
        self.assertEqual(g['texte_element'], '4.051230,9.767850'); self.assertEqual(g['valeur_json'], {'lat': 4.05123, 'lng': 9.76785})
        self.assertEqual(N('Text', 'time', '14h30')['texte_element'], '14:30')
        self.assertEqual(N('Text', 'multi:1=a;2=b;3=c', '3;1;1')['texte_element'], '1;3')
        self.assertEqual(N('Text', 'text', '  Mbarga   Paul ')['texte_element'], 'Mbarga Paul')
        for t, v in [('tel', '12'), ('email', 'x@'), ('gps', '4.05, 200'), ('time', '25:00'), ('multi:1=a', '1;9')]:
            with self.assertRaises(E): N('Text', t, v)
    def test_date(self):
        self.assertEqual(N('Date', 'date', '2026-01-15')['date_element'], date(2026, 1, 15))
        for v in ['15/01/2026', '1800-01-01', '2999-01-01']:
            with self.assertRaises(E): N('Date', 'date', v)

unittest.main(verbosity=1)
