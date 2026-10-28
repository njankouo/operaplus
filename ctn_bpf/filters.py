import django_filters
from django import forms
from .models import Operation, Personnel
class OperationFilter(django_filters.FilterSet):
    class Meta:
        model = Operation
        fields = ['nom', 'date_echeance', 'personnel']  # Version basique
