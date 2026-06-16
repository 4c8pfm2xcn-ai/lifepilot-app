import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, startOfWeek } from 'date-fns';
import { useStore } from '../store';
import { useColors, spacing, radius, fontSize, fontWeight, shadow } from '../theme';
import { MealType, GroceryCategory } from '../types';

const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];
const CATEGORY_ORDER: GroceryCategory[] = ['produce', 'meat', 'dairy', 'bakery', 'pantry', 'frozen', 'beverages', 'household', 'other'];
const CATEGORY_LABEL: Record<GroceryCategory, string> = {
  produce: 'Produce', meat: 'Meat & Seafood', dairy: 'Dairy', bakery: 'Bakery',
  pantry: 'Pantry', frozen: 'Frozen', beverages: 'Beverages', household: 'Household', other: 'Other',
};
type TabKey = 'plan' | 'grocery' | 'pantry';

export function MealPlannerScreen() {
  const colors = useColors();
  const recipes = useStore((s) => s.recipes);
  const plannedMeals = useStore((s) => s.plannedMeals);
  const grocery = useStore((s) => s.grocery);
  const pantry = useStore((s) => s.pantry);
  const planMeal = useStore((s) => s.planMeal);
  const removePlannedMeal = useStore((s) => s.removePlannedMeal);
  const generateGroceryFromMeals = useStore((s) => s.generateGroceryFromMeals);
  const addGroceryItem = useStore((s) => s.addGroceryItem);
  const toggleGroceryItem = useStore((s) => s.toggleGroceryItem);
  const clearCheckedGrocery = useStore((s) => s.clearCheckedGrocery);
  const deleteGroceryItem = useStore((s) => s.deleteGroceryItem);
  const addPantryItem = useStore((s) => s.addPantryItem);
  const deletePantryItem = useStore((s) => s.deletePantryItem);

  const [tab, setTab] = useState<TabKey>('plan');
  const [picker, setPicker] = useState<{ date: string; meal: MealType } | null>(null);
  const [newGrocery, setNewGrocery] = useState('');
  const [newPantry, setNewPantry] = useState('');

  const weekDays = useMemo(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'));
  }, []);

  const grouped = useMemo(() => {
    const g: Record<string, typeof grocery> = {};
    grocery.forEach((item) => { (g[item.category] = g[item.category] || []).push(item); });
    return g;
  }, [grocery]);

  const checkedCount = grocery.filter((g) => g.checked).length;

  const handleGenerate = () => {
    const n = generateGroceryFromMeals();
    setTab('grocery');
    Alert.alert(n > 0 ? 'Grocery list updated' : 'Nothing to add', n > 0 ? 'Added ' + n + ' item' + (n === 1 ? '' : 's') + ' from your planned meals.' : 'Plan some meals first, or items are already on your list / in your pantry.');
  };

  const mealFor = (date: string, meal: MealType) => plannedMeals.find((m) => m.date === date && m.mealType === meal);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Kitchen</Text>
        {tab === 'plan' && (
          <TouchableOpacity style={[styles.genBtn, { backgroundColor: colors.accent }]} onPress={handleGenerate}>
            <Ionicons name="sparkles" size={16} color="#FFF" />
            <Text style={styles.genBtnText}>Build list</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.tabs, { backgroundColor: colors.surfaceSecondary }]}>
        {(['plan', 'grocery', 'pantry'] as TabKey[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && { backgroundColor: colors.surface, ...shadow.sm }]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, { color: tab === t ? colors.text : colors.textSecondary }]}>
              {t === 'plan' ? 'Meal Plan' : t === 'grocery' ? 'Grocery' + (grocery.length ? ' (' + grocery.length + ')' : '') : 'Pantry'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'plan' && (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.huge }}>
          {weekDays.map((date) => (
            <View key={date} style={[styles.dayCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.dayLabel, { color: colors.text }]}>{format(new Date(date + 'T00:00:00'), 'EEEE, MMM d')}</Text>
              {MEAL_TYPES.map((meal) => {
                const planned = mealFor(date, meal);
                const recipe = planned ? recipes.find((r) => r.id === planned.recipeId) : null;
                return (
                  <TouchableOpacity key={meal} style={[styles.mealRow, { borderColor: colors.borderLight }]} onPress={() => planned ? removePlannedMeal(planned.id) : setPicker({ date, meal })}>
                    <Text style={[styles.mealType, { color: colors.textSecondary }]}>{meal[0].toUpperCase() + meal.slice(1)}</Text>
                    {planned ? (
                      <View style={styles.mealInfo}>
                        <Text style={[styles.mealName, { color: colors.text }]}>{recipe?.emoji || ''} {recipe?.name || planned.customName}</Text>
                        <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                      </View>
                    ) : (
                      <Ionicons name="add-circle-outline" size={20} color={colors.accent} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </ScrollView>
      )}

      {tab === 'grocery' && (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.huge }}>
          <View style={[styles.addRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput style={[styles.addInput, { color: colors.text }]} placeholder="Add an item..." placeholderTextColor={colors.textTertiary} value={newGrocery} onChangeText={setNewGrocery} onSubmitEditing={() => { if (newGrocery.trim()) { addGroceryItem(newGrocery.trim()); setNewGrocery(''); } }} returnKeyType="done" />
            <TouchableOpacity onPress={() => { if (newGrocery.trim()) { addGroceryItem(newGrocery.trim()); setNewGrocery(''); } }}>
              <Ionicons name="add-circle" size={26} color={colors.accent} />
            </TouchableOpacity>
          </View>

          {grocery.length === 0 && (
            <View style={styles.empty}>
              <Ionicons name="cart-outline" size={40} color={colors.textTertiary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Your grocery list is empty. Plan meals and tap "Build list".</Text>
            </View>
          )}

          {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
            <View key={cat} style={{ marginTop: spacing.lg }}>
              <Text style={[styles.catLabel, { color: colors.textSecondary }]}>{CATEGORY_LABEL[cat]}</Text>
              {grouped[cat].map((item) => (
                <TouchableOpacity key={item.id} style={[styles.groceryRow, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => toggleGroceryItem(item.id)} onLongPress={() => deleteGroceryItem(item.id)}>
                  <Ionicons name={item.checked ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={item.checked ? colors.success : colors.textTertiary} />
                  <Text style={[styles.groceryName, { color: colors.text, textDecorationLine: item.checked ? 'line-through' : 'none', opacity: item.checked ? 0.5 : 1 }]}>{item.name}</Text>
                  <Text style={[styles.groceryQty, { color: colors.textTertiary }]}>{item.quantity}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}

          {checkedCount > 0 && (
            <TouchableOpacity style={[styles.clearBtn, { borderColor: colors.border }]} onPress={clearCheckedGrocery}>
              <Text style={[styles.clearText, { color: colors.error }]}>Clear {checkedCount} checked item{checkedCount === 1 ? '' : 's'}</Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {tab === 'pantry' && (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.huge }}>
          <View style={[styles.addRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TextInput style={[styles.addInput, { color: colors.text }]} placeholder="Add pantry staple..." placeholderTextColor={colors.textTertiary} value={newPantry} onChangeText={setNewPantry} onSubmitEditing={() => { if (newPantry.trim()) { addPantryItem(newPantry.trim()); setNewPantry(''); } }} returnKeyType="done" />
            <TouchableOpacity onPress={() => { if (newPantry.trim()) { addPantryItem(newPantry.trim()); setNewPantry(''); } }}>
              <Ionicons name="add-circle" size={26} color={colors.accent} />
            </TouchableOpacity>
          </View>
          <Text style={[styles.hint, { color: colors.textTertiary }]}>Items in your pantry are skipped when building grocery lists.</Text>
          {pantry.map((item) => (
            <TouchableOpacity key={item.id} style={[styles.groceryRow, { backgroundColor: colors.surface, borderColor: colors.border }]} onLongPress={() => deletePantryItem(item.id)}>
              <Ionicons name="cube-outline" size={20} color={colors.textSecondary} />
              <Text style={[styles.groceryName, { color: colors.text }]}>{item.name}</Text>
              <Ionicons name="trash-outline" size={18} color={colors.textTertiary} onPress={() => deletePantryItem(item.id)} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <Modal visible={!!picker} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Choose a {picker?.meal}</Text>
              <TouchableOpacity onPress={() => setPicker(null)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>
            <ScrollView>
              {recipes.filter((r) => !picker || r.mealType === picker.meal || picker.meal === 'snack').map((r) => (
                <TouchableOpacity key={r.id} style={[styles.recipeRow, { borderColor: colors.borderLight }]} onPress={() => { if (picker) { planMeal({ date: picker.date, mealType: picker.meal, recipeId: r.id, servings: r.servings }); setPicker(null); } }}>
                  <Text style={styles.recipeEmoji}>{r.emoji}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.recipeName, { color: colors.text }]}>{r.name}</Text>
                    <Text style={[styles.recipeMeta, { color: colors.textTertiary }]}>{r.prepMinutes} min \u00B7 {r.calories || '\u2014'} cal \u00B7 {r.ingredients.length} ingredients</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: fontSize.display, fontWeight: fontWeight.bold },
  genBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg, borderRadius: radius.full },
  genBtnText: { color: '#FFF', fontWeight: fontWeight.semibold, fontSize: fontSize.sm },
  tabs: { flexDirection: 'row', marginHorizontal: spacing.lg, borderRadius: radius.md, padding: 4, marginBottom: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  dayCard: { borderRadius: radius.lg, borderWidth: 1, padding: spacing.lg, marginBottom: spacing.md },
  dayLabel: { fontSize: fontSize.md, fontWeight: fontWeight.bold, marginBottom: spacing.sm },
  mealRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  mealType: { fontSize: fontSize.sm, fontWeight: fontWeight.medium, width: 80 },
  mealInfo: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1, justifyContent: 'flex-end' },
  mealName: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
  addRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, gap: spacing.sm },
  addInput: { flex: 1, height: 44, fontSize: fontSize.md },
  catLabel: { fontSize: fontSize.sm, fontWeight: fontWeight.bold, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.sm },
  groceryRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm },
  groceryName: { flex: 1, fontSize: fontSize.md },
  groceryQty: { fontSize: fontSize.sm },
  clearBtn: { marginTop: spacing.xl, paddingVertical: spacing.md, borderRadius: radius.md, borderWidth: 1, alignItems: 'center' },
  clearText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  empty: { alignItems: 'center', paddingTop: spacing.huge, gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyText: { fontSize: fontSize.md, textAlign: 'center', lineHeight: 22 },
  hint: { fontSize: fontSize.sm, marginVertical: spacing.md },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.huge, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  recipeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
  recipeEmoji: { fontSize: 28 },
  recipeName: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  recipeMeta: { fontSize: fontSize.sm, marginTop: 2 },
});
