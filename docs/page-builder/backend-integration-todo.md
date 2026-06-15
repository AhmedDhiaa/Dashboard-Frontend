# Backend Integration TODO — Page Builder

> ملف تذكيري للمتطلَّبات في الـ Backend (ABP) لإكمال
> features الـ Page Builder. الـ frontend يحتفظ بـ
> graceful fallbacks لكل واحد.

## Critical (P0) — قبل الإنتاج الواسع

### 1. SignalR `PageUpdated` hub method
**الحالة:** غير منفَّذ في الـ Backend
**Frontend:** silent fallback عبر NEXT_PUBLIC_PAGE_BUILDER_LIVE_RELOAD flag
**Commit:** 14d141e

**المطلوب من الـ Backend:**
```csharp
public class PageBuilderHub : Hub
{
    public async Task PageUpdated(string pageId)
    {
        await Clients.Others.SendAsync("ReceivePageSchemaChanged", pageId);
    }
}
```

**بعد التنفيذ:** فعِّل NEXT_PUBLIC_PAGE_BUILDER_LIVE_RELOAD=true
في .env. لا تغيير في الكود.

### 2. (أضِف هنا أي debt لاحق نكتشفه)

## Future enhancements (P1)

### Page Builder dedicated permissions
- حالياً: Api.Admin.PageBuilder صلاحية واحدة شاملة
- المرغوب لاحقاً:
  * Api.Admin.PageBuilder.View
  * Api.Admin.PageBuilder.Create
  * Api.Admin.PageBuilder.Edit
  * Api.Admin.PageBuilder.Delete
  * Api.Admin.PageBuilder.Materialize
- **Frontend:** مرن، نضيف PERMISSIONS constants عند الاحتياج

## كيفية تحديث هذا الملف
بعد كل bug من نوع "Backend غير جاهز" نكتشفه أثناء التطوير،
أضِف entry هنا. هذا يمنع تكرار التشخيص.
