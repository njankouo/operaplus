
import debug_toolbar
from django.contrib import admin
from django.conf import settings
from django.urls import path,include,re_path 
from django.conf.urls.static import static
from django.views.static import serve
from ctn_bpf import views 

urlpatterns = [
    path('', include('ctn_bpf.urls')),
   
    path('admin/', admin.site.urls),
    path('__debug__/', include(debug_toolbar.urls)),
]
handler404 = 'ctn_bpf.views.custom_page_not_found_view'
handler500 = 'ctn_bpf.views.custom_error_view'
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
urlpatterns += [re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT,}),]
urlpatterns += [re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.STATIC_ROOT,}),]


