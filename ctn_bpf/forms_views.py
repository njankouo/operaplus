from django.shortcuts import get_object_or_404, redirect
from django.http import HttpResponseRedirect
from django.views.generic import DetailView
from .models import DataSetOperation, Structure, PeriodeOk
from .utils import basis  # Assurez-vous que basis est dans un fichier utils.py

class DetailFormulaireOp(DetailView):
    model = DataSetOperation
    context_object_name = 'dataset_fom'

    def dispatch(self, request, *args, **kwargs):
        # 1. On appelle basis() pour intercepter les redirections
        self.user_context = basis(request)
        
        if isinstance(self.user_context, HttpResponseRedirect):
            return self.user_context
            
        # CORRECTION : On transmet bien *args et **kwargs
        return super().dispatch(request, *args, **kwargs)

    def get_object(self, queryset=None):
        # Récupération sécurisée de l'objet
        return get_object_or_404(
            DataSetOperation, 
            dataset_id=self.kwargs['dataset_id'], 
            operation_id=self.kwargs['op_id']
        )

    def get_template_names(self):
        """
        Permet de choisir dynamiquement le template 
        en fonction de la valeur de count_write de l'objet récupéré.
        """
        # self.object est automatiquement disponible ici grâce à get_object()
        if self.object and self.object.count_write > 0:
            return ['brouillon.html']
        return ['detail-forms.html']

    def get_context_data(self, **kwargs):
        # 2. On récupère le contexte de base
        context = super().get_context_data(**kwargs)
        
        # 3. On injecte le contexte utilisateur
        context.update(self.user_context)
        
        # 4. On ajoute les éléments spécifiques
        actual_institution = context.get('actual_institution')
        structure = Structure.objects.filter(parent=None, institution=actual_institution)
        periode_ok = PeriodeOk.objects.distinct('annee')
        context['dataset'] = DataSetOperation.objects.filter(dataset_id=self.kwargs['dataset_id'],operation_id=self.kwargs['op_id'])
        context['structure'] = structure
        context['periode_ok'] = periode_ok
        context['sub_structures'] = {s.id: Structure.objects.filter(parent=s) for s in structure}
        
        return context