from django.urls import path, include
from rest_framework.authtoken.views import obtain_auth_token

from . import views
from . import views_iso
# app_name = 'ctn_bpf'
from graphene_django.views import GraphQLView
from rest_framework import routers
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
router = routers.SimpleRouter()

router.register('operation', views.OperationViewSet, basename='operation')

router.register('personnel', views.PersonnelViewSet, basename='personnel')

router.register('indicateur', views.IndicateurViewSet, basename='indicateur')

router.register('institution', views.InstitutionViewSet, basename='institution')

urlpatterns = [
   path('', include('pwa.urls')), 
   path("", include("vitrine.urls")),
   path('api-auth/', include('rest_framework.urls')),
   path('api/',include(router.urls)),
   path('i18n/', include('django.conf.urls.i18n')),

   path('accounts/', include('allauth.urls')),
   path('', include('ctn_bpf.urls-iso')),

   path('login/', obtain_auth_token, name='login'),
   path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),

   path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
   path('api/login/', views.CustomLoginView.as_view(), name='api-login'),
   path('api/logout/',views.LogoutView.as_view(), name='api-logout'),

   path('',views.index,name ='index'),
   path('assistance/',views.assistance,name= 'assistance'),
   path('<int:nature>/',views.index,name ='index_catal'),
   path('admin_institution/',views.admin_institution,name='admin_institution'),
   path('contact/',views.contact,name='contact'),
   path('chaine_indicateurs/',views.chaine_indicateurs,name='chaine_indicateurs'),
   path('edit_institution/<int:institution_id>/',views.edit_institution,name='edit_institution'),
   path('documentation/',views.documentation,name='documentation'),
   path('save_institution/',views.save_institution,name='save_institution'),
   path('save_edit_institution/',views.save_edit_institution,name='save_edit_institution'),
   path('main/',views.main,name='main'),
   path('main/<int:menu_main>/',views.main,name='main_menu'),
   path('bad_auth/',views.bad_auth,name='bad_auth'),
   path('log_account/',views.log_account,name='log_account'),
   path('log/',views.log,name='log'),
   path('log/<int:out>/',views.log,name='log_out'),
   path('log_plus/',views.specific_log,name='specific_log'),
   path('decision/<str:nature>/<int:operation_id>/',views.decision,name='decision'),
   path('decision/<str:nature>/<int:element_id>/<int:operation_rapport_id>/',views.decision,name='decision'),
   path('gestionnaire/<str:gest_val>/',views.gestionnaire,name='gest_val'),
   path('get_indicateur_value/',views.get_indicateur_value,name='indicateur_value'),
   path('gestionnaire/<str:gest_val>/<int:gest_id>/',views.gestionnaire,name='gest_val_id'),
   path('modify/<str:arg_val>/',views.modify,name='modify'),
   path('operations/',views.operations_home,name='operations_home'),
   path('operations/details/<int:operation_id>/',views.operations_details_list,name='operations_details_list'),
   path('operations/<int:operation_id>/',views.operations_details,name='operations_details'),
   path('notifications/',views.notifications,name='notifications'),
   #path('messages/',views.messages,name='messages'),
   path('assign_supervisor/',views.assign_supervisor,name='assign_supervisor'),
   path('valid_rapport/',views.valid_rapport,name='valid_rapport'),
   path('in_valid_rapport/',views.in_valid_rapport,name='in_valid_rapport'),
   path('delete/',views.delete,name='delete'),
   path('delete_mul/',views.delete_mul,name='delete_mul'),
   path('configurations/',views.configurations,name='configurations'),
   path('institution/',views.institutions,name='institution'),
   path('profile/',views.profile,name='profile'),
   path('history/',views.history,name='history'),
   path('history/<str:dates>/',views.history,name='history_dates'),
   path('extra/',views.extra,name="extra"),
   path('save_period/',views.save_period,name='save_period'),
   path('set_period/<int:period>/',views.set_default_period,name='set_session'),
   path('set_institution/<int:institution_id>/',views.set_institution,name='set_institution'),
   path('set_period/<int:period>/<int:sub_period>/',views.set_default_period,name='set_session2'),
   path("avis-consulted/<int:id>/", views.AvisConsulted, name="avis-consulted"),
   path('tache-non-effectuee/',views.List,name='tache-non-effectuee'),
   path('tache-effectuee/',views.taches_effectuee,name="tache-effectuee"),
   path('Avis/c/<int:id>',views.Avis,name='Avis'),
   path('Avis/i/<int:id>/',views.Avis_informed,name='Avis'),
   path('recuperer_personnel/',views.recuperer_personnel,name="recuperer_personnel"),
   path('save_design/',views.design_form,name="save_design"),
   path('data_sets_edit/<int:id>/',views.edit_dataset,name="data_sets_edit"),
   path('count_operations/',views.count_operations,name="count_operations"),
   path('count_informed/',views.count_informed,name="count_informed"),
   path('count_tache_consulted/',views.count_tache_consulted,name="count_tache_consulted"),
   path('tache_consulted/',views.tache_consulted,name='tache_consulted'),
   path('edit_data/<int:id>/',views.edit_data,name="edit_data"),
   path('count_persos/',views.count_persos,name="count_persos"),
   path('count_accountable/',views.count_accountable,name="count_accountable"),
   path('count_effectuee/',views.count_effectuee,name="count_effectuee"),
   path('tache-valide/',views.tach_valid,name="tache-valide"),
   path('soft_delete/<int:id>',views.archive,name="soft_delete"),
   path('tache-archive/',views.archive_list,name="tache-archive"),
   path('soft_deleted/<int:id>',views.restore,name="soft_deleted"),
   path('count_restored/',views.count_restored,name="count_restored"),
   path('save_comment/',views.save_comment,name="save_comment"),
   path('operation_file/<int:id>',views.file,name="operation_file"),
   path('avis_inform/',views.Avis_Informed,name="avis_inform"),
   path('edit_form/<int:id>',views.edit_form,name="edit_form"),
   path('edit-personnel/<int:id>/',views.edit_personnel,name="edit_personnel"),
   path('recup_password',views.recup_password,name="recup_password"),
   path('verify/<str:email>',views.verify,name="verify"),
   path('verify_code',views.verify_code,name="verify_code"),
   path('new_password/',views.new_password,name="new_password"),
   path('save_password',views.save_password,name="save_password"),
   path('tache-Attente/',views.tache_attente,name="tache-attente"),
   path('import/', views.import_from_excel, name='import_from_excel'),
   path('historique/',views.historique,name='historique'),
   path('message/',views.message,name="message"),
   path('view/file/<int:id>',views.View_file,name="view_file"),
   path('rejet_rapport/<int:id>',views.rejet_rapport,name="rejet_rapport"),
   path('count_consult/',views.count_consult,name="count_consult"),
   path('View_file_operation/<int:id>/',views.View_file_operation,name="View_file_operation"),
   path('data_set/modif/<int:id>/',views.modif_form,name="data_set"),
   path('error_page/',views.error_page,name="error_page"),
   path('regroup_consulted/',views.regroup_consulted,name="regroup_consulted"),
   path('download_files/<int:id>/',views.download_files,name="download_files"),
   #path('create_indicateurval/',views.create_indicateurval,name="create_indicateurval"),
   path('load_structur/',views.load_file,name="load_structur"),
   path('load_entity/',views.load_entity,name="load_entity"),
   path('licences/',views.licences,name="licences"),
   path('add_license/',views.add_license,name="add_license"),
   path('add_users/',views.add_users,name="add_users"),
   path('archive_doc/',views.archive_doc,name="archive_doc"),
   path('add_categorie/',views.add_categorie,name="add_categorie"),
   path('add_archive/',views.add_archive,name="add_archive"),
   path('convert_to_pdf/',views.convert_to_pdf,name="convert_to_pdf"),
   path('download/<int:id>',views.download,name="download"),
   path('ma_vue/',views.ma_vue,name="ma_vue"),
   path('404/', views.custom_page_not_found_view, {'exception': Exception("Page non trouvée")}),
   path('500/', views.custom_error_view, {'exception': Exception("Erreur serveur")}),

   path('search-personnel/', views.Search_Personnel, name='search-personnel'),

   path('inscription/', views.MealAfrique, name='inscription'),

   path('soft_delete_institution/<int:institution_id>/', views.soft_delete_institution, name='soft_delete_institution'),

   path('synchronisation-data/', views.register_expert, name='synchronisation-data'),

   path('count-members-of-countries/', views.group_member_by_country, name='count-members-of-countries'),

   path('count-male-and-female/', views.count_male_and_female, name='count-members-male-and-female'),

   path('organisation/<slug:slug>/', views.organisation_detail, name='organisation-detail'),

   path('my-card-meal-afrique/', views.myCard, name='my-card-meal-afrique'),

   path('check-email/', views.check_email_ajax, name='check-email'),

   path('Information-members/<str:code>/', views.Information_members, name='Information-members'),

   path('Edit-Profil/<str:code>/', views.EditProfil, name='Edit-Profil'),

   path('Update-profil/', views.Updateprofil, name='Update-profil'),

   path('count-members/', views.CountMembers, name='count-members'),

   path('meal-vision/', views.Vision, name='meal-vision'),

   path('meal-mission/', views.Mission, name='meal-mission'),

   path('meal-domaines/', views.Domaine, name='meal-domaines'),

   path('meal-activites/', views.Activite , name='meal-activites'),

   path('meal-valeurs/', views.Valeur, name='meal-valeur'),

   path('meal-about-use/', views.AboutUse, name='meal-about-use'),

   

   path('ia-analyse/<int:id>/', views.AnalyseIa, name='ia-analyse'),

   path('license/', views.license, name='license'),

   path('save_personnel_institution/', views.save_personnel_institution, name="save_personnel_institution"),

   path('dynamic-cible/<int:id>/', views.dynamic_cible, name='dynamic_cible'),

   path('save_meal_data/', views.save_meal_data, name='save_meal_data'),
   path(
        'meal-dashboard-analytics/<int:indicateur_id>/',
        views.meal_dashboard_analytics,
        name='meal_dashboard_analytics'
   ),

   path('activer_periode/<str:m_value>/', views.activer_periode, name='activer_periode'),

   path('indicateur/analyse_data/<int:id>/', views.analyse_data, name='indicateur-analyse_data'),

   path('packages/', views.liste_packages, name='packages'),

   path('checkout/pay/<slug:slug>/',views.Upgrade, name='checkout-pay'),

   

   path('active-package/', views.ActivePackage, name='active-package'),

   path('activate-abonnement/<int:id>/', views.valider_abonnement, name='activate-abonnement'),


   path('members-meal-afrique/<str:country>/', views.memberscountry, name='members-meal-afrique'),

   path('demos/', views.demos, name='demos'),

   path('demander_demo/', views.demander_demo, name='demander_demo'),

   path('active-package-user/', views.ActivePackageUser, name='active-package-user'),
   path('archive/<int:archive_id>/', views.detail_archive, name='detail_archive'),
   path('archives/sous-categorie/<int:sous_cat_id>/', views.liste_archives_par_sous_cat, name='liste_archives_par_sous_cat'),
   path('accounts/', include('allauth.urls')),

   path('checkout/<str:slug>/', views.checkout, name='checkout'),
   path('process-payment/', views.process_paiement, name='process-payment'),

   path('payment/', views.payment, name='payment'), 

   path('confirm-checkout/<str:slug>/', views.confirmcheckout, name='confirm-checkout'),

   path('valid_process_paiement/', views.valid_process_paiement, name='valid_process_paiement'),

   path('delete_categorie_archive/<int:id>/', views.delete_categorie_archive, name='delete_categorie_archive'),

   path('fields-institution/', views.fields_institution, name='fields-institution'),

   path('save-fields/', views.save_fields, name='save-fields'),

   path('delete_entity_type/<int:id>/', views.delete_entity_type, name='delete_entity_type'),

   path('delete-page/<int:id>/', views.delete_page, name='delete_page'),

   path('define-etape/<int:id>/', views.define_etape, name='define-etape'),

   path('detail-personnel/<str:mail>/', views.detail_personnel, name='detail-personnel'),

   path('save_operation_step/', views.save_operation_step, name='save_operation_step'),

   path('details-etapes/<int:id>/', views.details_etapes, name='details-etapes'),

   path('a-propos/', views.a_propos, name='a-propos'),
   path('annonces/', views.annonces, name='annonces'),

   path('api/chat/', views.api_chat, name='api-chat'),

   path('advance-dashboard/', views.AdvanceDashboard, name='advance-dashboard'),

   path('tache-informed/', views.TacheInformed, name='tache-informed'),

   path('send-avis/', views.SendAvis, name='send-avis'),

   path('historique-tache-informed/<int:id>/', views.HistoriqueTask, name="historique-tache-informed"),

   path('ajouter-formulaire/<int:id>/', views.AjouterFormulaire, name="ajouter-formulaire"),

   path('save-dataset-operation/', views.SaveDataSet, name='save-dataset-operation')



   

]

gestionnaire_url_patterns = [
   path('duplicate_institution/',views.duplicate_institution,name='duplicate_institution'),
   path('structures/',views.structures,name='structures'),
   path('personnels/',views.personnels,name='personnels'),
   path('perso/<int:perso_id>/',views.personnel_id,name='personnels_details'),
   path('personnels_raci/',views.personnels_raci,name='personnels_raci'),
   path('users_simples/',views.users_simples,name='users_simples'),
   
   path('no_institution/', views.no_institution, name='no_institution'),

   path('structures/',views.structures,name='structures'),
   path('dataelts/',views.dataelts,name='data_elets'),
   path('dataelts/<int:elt_id>/',views.dataelts,name='data_elets_id'),
   path('dataelts/<int:elt_id>/<int:elt_str>/',views.dataelts,name='data_elets_id2'),
   path('dataelts/indic/',views.dataelts_indic,name='data_elets_indic'),
   path('dataelt/edit/<int:elt_id>/',views.dataelts_edit,name='data_elets'),
   path('data_elements/',views.data_elements,name='data_elements'),
   path('data_sets/<int:indi_id>/',views.data_sets,name='data_sets'),
   path('data_sets/design/<int:dS_id>/',views.data_sets_design,name='data_sets'),

   path('data_form/<str:nature>/<int:elt_id>/',views.data_form,name="data_form"),
   path('roles/',views.roles,name='roles'),
	path('taches/<int:tache_id>/',views.ges_taches,name='ges_taches'),
   path('taches/<int:tache_id>/<int:arg_period>/',views.ges_taches,name='ges_taches'),
   path('alert_notifs/<str:tree>/<int:report>/',views.alert_notifs,name='alert_notifs'),
   path('add_cat_nat/<int:id>/',views.add_cat_nat,name="add_cat_nat"),

   path('count_attente_operation/',views.count_attente_operation,name="count_attente"),

   path('activ_form/<int:id>/',views.activ_form,name="activ_form"),
   path('add_sous_actualite/',views.add_sous_actualite,name="add_sous_actualite"),
   path('delete_sous_actualite/<int:id>/',views.delete_sous_actualite,name="delete_sous_actualite"),
   path('modifier-structure/<int:id>/', views.UpdateStructure, name='modifier-structure'),
   path('update-structure-data/<int:id>/', views.UpdateDataStructure, name='update-structure-data'),


   path('edit_baniere_institution/',views.edit_baniere_institution,name="edit_baniere_institution"),
   path('get_dataset/<int:dataset_id>/',views.get_dataset,name="ajax_form_2"),

   path('access_website/<int:id>/',views.actual,name="actual"),
   path('edit_sous_actualite/<int:id>/',views.edit_sous_actualite,name="edit_sous_actualite"),
   path('update_sous_actuality/<int:id>/',views.update_sous_actuality,name="update_sous_actuality"),
   path('edit_baniere/<int:id>/',views.edit_baniere,name="edit_baniere"),
   path('edit_baniere_up/<int:id>/',views.edit_baniere_up,name="edit_baniere_up"),
   path('delete_nature/<int:id>/',views.delete_nature,name="delete_nature"),
   path('delete_categorie/<int:id>/',views.delete_categorie,name="delete_categorie"),
   path('get_dataset_accountable/<int:id>/',views.get_dataset_accountable,name="get_dataset_accountable"),
   path('save_value/',views.save_value,name="save_value"),
   path('load_data/<int:structure_id>/<int:periode_id>/', views.load_data,name='load_data'),
   path('toggle_public/',views.toggle_public,name='toggle_public'),
   path('delete_institution/<int:id>/',views.delete_institution,name='delete_institution'),
   path('dataset_load/<int:id>/<int:operation_id>/',views.dataset_load,name='dataset_load'),
 
   path('api_operations/',views.get_operations,name='get_operations'),
   path('line_delete_structure/<int:id>/',views.line_delete_structure,name='line_delete_structure'),
   path('upload-sub-structure/<int:id>/', views.UploadSubStructure, name='upload-sub-structure'),

   path('import_structure_view/',views.import_structure_view, name='import_structure_view'),

   path('devise_create/',views.devise_create,name='devise_create'),

   path('gantt/',views.gantt,name='gantt'),

   path('alert-supression/<int:id>/', views.alert_supression, name="alert-supression"),

   path('transactions/<int:id>/', views.transactions, name='transactions'),

   path('valid-transaction/', views.ValidTransaction, name='valid-transaction'),


   path('editer-tache/<int:id>/',views.file_duplik,name='editer-tache'),

   path('duplicate_operation/<int:id>/',views.duplicate_operation,name='duplicate_operation'),
   path('forms/',views.forms_data,name='forms'),
   # path('set_language/', views.set_language, name='set_language'),
   path('delete_indicateur/<int:id>/',views.delete_indicateur,name='delete_indicateur'),

   path('add_groupe_indicateur/',views.add_groupe_indicateur,name='add_groupe_indicateur'),

   path('Associer_groupe_indicateur/<int:id>/',views.Associer_groupe_indicateur,name='Associer_groupe_indicateur'),

   # path('add_masters_indicateur/',views.add_masters_indicateur,name='add_masters_indicateur'),
   path('add_groupe_structure/',views.add_groupe_structure,name='add_groupe_structure'),
   path('list_element/<int:id>/',views.list_element,name='list_element'),
   path('list_indicator_group/<int:id>/',views.list_indicator_group,name='list_indicator_group'),
   path('delete_group_indicator/<int:id>/',views.delete_group_indicator,name='delete_group_indicator'),

   path('delete_groupe_element/<int:id>/',views.delete_groupe_element,name='delete_groupe_element'),

   path('delete_data_element/<int:id>/',views.dataelt,name='dataelt'),
   path('loaddata_set/<int:id>/<int:operation_id>/',views.loaddata_set,name='loaddata_set'),
   path('groupe_structure/',views.groupe_structure,name='groupe_structure'),

   path('add_forms/<int:id>/',views.add_forms,name='add_forms'),

   path('add_periodes/', views.MonFormulaireView.as_view(), name='ton_view_name'),
   path('delete_periodes/<int:id>/',views.Deletes_periodes,name='deletes_periodes'),

   path('add_dataset_institution/<int:id>/',views.add_dataset_institution,name='add_dataset_institution'),
   path('account/<int:id>/',views.account,name='account'),

   path('actualites_modif/<int:id>/',views.actualites_modif,name='actualites_modif'),
   path('edition_actualite/<int:id>/',views.edition_actualite,name='edition_actualite'),
   path('api/taux_valid/', views.taux_valide, name='api-taux_valid'),
   path('api/taux_valid/',views.budget_valid, name='api-taux_valid'),

   path('get-etape-form/<int:id>/', views.get_etape_form, name='get_etape_form'),

   path('update-etape/<int:id>/', views.update_etape, name='update_etape'),

   path('download/<int:id>/',views.download_report, name='download_report'),

   path('elementEntity/<int:id>/', views.elementEntity, name='elementEntity'),
   
   path('generate-pdf-raci/', views.GeneratePdfMatriceRaci, name='generate-pdf-raci'),
   
   path('delete_entities_operations/<int:id>/',views.delete_entities_operations,name='delete_entities_operations'),
   
   path('update_raci/<int:id>/',views.UpdateRACI,name='update_raci'),
   
   path('Update-Entities/<int:id>/', views.Update_Entities, name='Update-Entities'),
   
   path('toggle_devise/<int:id>/', views.toggle_devise, name='toggle_devise'),
   
   path('Update-Entity/<int:id>/', views.Update_Entity, name='Update-Entity'),
   
   path('detail-gantt/<int:id>/', views.detail_gantt, name='detail_gantt'),
   
   path('update-planification/', views.EditPlanification, name='update-planification'),
   
   path('update_transaction/<int:id>/', views.UpdateTransaction, name='update_transaction'),
   
   path('api/champs-par-entite/', views.champs_par_entite, name='champs_par_entite'),
   
   path('edit-dynamic/<int:id>/',views.DynamicInput, name='edit-dynamic'),
   
   path('notifications-system/', views.NotificationSystem, name='notifications-system'),
   
   path('tache-retards/', views.liste_operations_retard, name='tache-retards'),
   
   path('api/suggerer-commentaire/', views.suggerer_commentaire, name='api-suggerer-commentaire'),

   path('save_inst_settings/<int:id>/',views.save_inst_settings, name='save_inst_settings'),

   path('check-periods/', views.check_elements, name='check-periods'),

   path('check-elements/', views.check_elements, name='check-elements'),

   path('check-orgunits/',views.check_orgunits, name='check-orgunits'),

   path('final-import-data/', views.final_import_data, name='final-import-data'),

   path('save_dataelts/', views.save_dataelts, name='save_dataelts'),

   path('details_cumul/<int:id>/', views.details_cumul, name='details_cumul'),

   path('api/indicators/calculate/', views.calculate_indicators, name="api-indicators-calculate"),

   path('import-periode/', views.import_periode, name='import-periode'),

   path("import-periods-data/", views.import_periods_view, name="import_periods_data"),

   path('define-periode/', views.defineperiod, name='define-periode'),

   path('valide-date/', views.UpdateDate, name='valide-date'),

   path('dupliquer-institution/<int:id>/', views.Dupliquerinstitution, name='dupliquer-institution'),

   path('Details-periodes/', views.Detailperiode, name='Details-periodes'),
   path('import-status/<str:task_id>/', views.check_import_status, name='import_status'),

   path('accountable/', views.accountable, name='accountable'),

   path('count_accountable_operation/', views.count_accountable_operation, name='count_accountable_operation')
   
]  
ajax_urls_patterns = [
   path('count_notifs/',views.notifs,name='notifs'),
   path('count_rapps/',views.notifs_rapp,name='notifs_rapp'),
   path('count_indic/',views.indicateurs_ajax,name='indicateur_ajax'),
   path('ajax_graphiques/',views.ajax_graphiques,name='ajax_graphiques'),
   path('ajax_lines/',views.ajax_lines,name='ajax_lines'),
   path('get_elements/',views.get_elements,name='get_elements'),
   path('get_elements_hierachy/',views.get_elements_hierachy,name='get_elements_hierachy'),
   path('get_elements_subsequency/',views.get_elements_subsequency_true,name='get_elements_subsequency_true'),
   path('get_indi_data/',views.get_indi_data,name='get_indi_data'),
   path('ajax_restore/',views.ajax_restore,name='ajax_restore'),
   path('ajax_institution/',views.ajax_institution,name='ajax_institution'),
   path('print_pdf/',views.print_pdf,name='print_pdf'),
   path('ajax_progress/',views.ajax_progression,name='ajax_progress'),
   path('get_progressions/',views.get_progressions,name='get_progressions'),
   path('ajax_calcul_date/',views.ajax_calcul_date,name='ajax_calculate_date'),
   path('ajax_form/',views.ajax_form,name='ajax_form'),
   path('ajax_RACI_user/',views.ajax_RACI_user,name='ajax_RACI_user'),
   path('ajax_RACI_user/manage/',views.ajax_RACI_user_manage,name='ajax_RACI_user'),
   path('ajax_hiera_struc/',views.ajax_hiera_struc,name='ajax_hiera_strux'),
   path('update_categorie/<int:id>/',views.update_categorie,name="update_categorie"),
   path('edit_natures/<int:id>/',views.edit_natures,name="edit_natures"),
   path('edit_categorie_up/<int:id>/',views.edit_categorie_up,name="edit_categorie_up"),
   path('edit_nature_up/<int:id>/',views.edit_nature_up,name="edit_nature_up"),
   path('add_information_actualite/<int:id>/',views.add_information_actualite,name="add_information_actualite"),
   path('add_information_data/<int:id>/',views.add_information_data,name="add_information_data"),

   path('add_nature_indicateur/',views.add_nature_indicateur,name='add_nature_indicateur'),
   path('data_sets_duplicate/<int:id>/',views.data_sets_duplicate,name='data_sets_duplicate'),

   path('delete_selected_operations/',views.delete_selected_operations,name='delete_selected_operations'),

   path('view_reult/<int:id>/',views.view_reult,name='view_reult'),
   path('matrix-raci/', views.MatrixRACI, name='matrix-raci'),
   path('filtrer_archives/', views.filtrer_archives, name='filtrer_archives'),
   
   path('send_messages/', views.send_messages, name='send_messages'),

   path('organigramme/', views.organigramme, name='organigramme'),

   path('aggregation_indicator/<int:id>/', views.aggregation_indicator, name='aggregation_indicator'),

   path('delete_hierachie/<int:id>/', views.delete_hierachie, name='delete_hierachie'),
   path('update_level/<int:id>/', views.update_level, name='update_level'),

   path('modify-hierachy/<int:id>/', views.ModifyHierachy, name='modify-hierachy')

]
save_url_patterns = [
   path('save_entity/',views.save_entity,name='save_entity'),
   path('save_entity_value/',views.save_entity_value,name='save_entity_value'),
   path('save_indicateur/',views.save_indicateur,name='save_indicateur'),
   path('save_gestion/',views.save_gestion,name='save_gestion'),
   path('save_plannify/',views.save_plannify,name='save_plannify'),
   path('save_rapport/',views.save_rapport,name='save_rapport'),
   path('save_valid_rapport/',views.save_valid_rapport,name='save_valid_rapport'),
   path('valid_observations/',views.valid_observations,name='valid_observations'),
   path('assign_RACI/',views.assign_RACI,name='assign_RACI')
]

filter_urls = [
   path('filter_op/',views.filter_op,name='filter_op'),
   path('filter_entity/',views.filter_entities,name='filter_entities'),
   path('gestionnaire_search/',views.gestionnaire_search,name='gestionnaire_search'),
   path('search/',views.search,name='search'),
   path('search2/<str:menu>/',views.search2,name='search2'),
   path('filter_op/search/',views.filter_op_search,name='filter_op'),
   path('filter_perso/<int:structure_id>/<int:role_id>/',views.filter_perso,name='filter_perso'),
   path('structures/<int:structure_id>/',views.structure_details,name='structure_details'),
   path('structures_hie/',views.structure_hie,name='structure_details_f'),
   path('evaluer/<str:hierachie>/',views.evaluer,name='evaluer'),
   path('evaluer/<str:hierachie>/<int:gest_id>/',views.evaluer,name='evaluer'),
   path('evaluer_detail/<int:gest_id>/',views.evaluer_detail,name='evaluer_detail'),
   path('indic/<int:indic_id>/',views.indic_plus,name='indic_plus'),
   path('search_period_id/<int:id>/',views.search_period_id,name='search_period_id'),

   path('grub_form/<int:id>/',views.grub_form,name='grub_form'),
   path('gantt_planification/',views.gantt_planification,name='gantt_planification'),

   path('relancer_transaction/<int:transaction_id>/',views.send_mail_relance, name='send-mail'),

   path('count_operation_retard/', views.count_operation_retard, name='count_operation_retard'),

   path('retard-personnel/', views.retard_personnel, name='retard-personnel'),

   path('details-retard-transaction/', views.retard_transaction_personnel, name='details-retard-transaction'),

   path('save_operation/', views.save_operation, name='save_operation'),

   path('priorisation/', views.priorisation, name='priorisation'),
   path('priorisation/update/', views.priorisation_update, name='priorisation_update'),

 

]

# Ajouter Journal RACI

log_urls = [
   path('messengers/',views.messengers,name="messengers"),

   path('bad_pass/',views.bad_pass,name='bad_pass'),
   path('restorepass/',views.restorepass,name='restorepass'),
   path('print_mail_file/',views.print_mail_file,name='print_file'),
   path('agenda/',views.agenda,name='agenda'),
   path('genPDF/',views.print_pdf,name="gen_PDF")
]
urlpatterns += ajax_urls_patterns
urlpatterns += gestionnaire_url_patterns
urlpatterns += save_url_patterns
urlpatterns += filter_urls
urlpatterns += log_urls
#path('calendar/',views.calendar,name='calendar'),
